export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/turn — 発話ログ追記（F4-1）
// クライアントが Realtime のイベントからテキストを拾い、まとめて送る。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadSessionByToken } from '@/lib/mensetsu/public'
import { waitUntil } from '@vercel/functions'
import { runEvaluation } from '@/lib/mensetsu/run-evaluation'
import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'

type Ctx = { params: Promise<{ token: string }> }

const MAX_TURNS_PER_CALL = 50
const MAX_TEXT_LEN = 5000

// 任意の時刻・質問番号は、不明を0へ変換しない。
// 壊れた補助情報があっても発話本文は保存し、不明な値はNULLとして扱う。
function optionalNonnegativeInt(value: unknown): number | null {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(number) && number >= 0 && number <= 2147483647 ? number : null
}


export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  // ⚠️ ここで assertUsable をそのまま使うと、面接中に期限を跨いだり
  //    担当者が close した瞬間から 4xx になり、送信中だった発話が
  //    クライアント側で破棄されて逐語ログがぶつ切りになる。
  //    書き込みを閉じるのは「評価が済んだ後」と「終了から十分に経った後」に限定する。
  //    （評価前の追記は面接中にも可能なので、ここを厳しくしても偽装は防げない）
  const GRACE_MS = 10 * 60 * 1000
  if (s.purgeAfter && s.purgeAfter.getTime() < Date.now()) {
    return NextResponse.json({ error: 'この面接の記録は削除されています' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({}))
  const incoming = Array.isArray(body?.turns) ? body.turns.slice(0, MAX_TURNS_PER_CALL) : []
  if (incoming.some((t: any) => t?.id != null && (typeof t.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(t.id)))) {
    return NextResponse.json({ error: '発話の識別子が正しくありません' }, { status: 400 })
  }
  if (incoming.length === 0) return NextResponse.json({ saved: 0 })

  // ⚠️ 到着順ではなく「話し始めた時刻」で並べてから採番する。
  //    発話は読み上げ／認識が終わって初めて確定するため、到着順のままだと
  //    長い発話が後ろにずれ、逐語ログが会話の順序として読めなくなる
  //    （実際に本番で、面接官の冒頭挨拶より応募者の相槌が先に並んだ）。
  //    評価AIもこのログを根拠に読むため、順序が狂うと採点が歪む。
  const rows: Prisma.MensetsuTurnCreateManyInput[] = incoming
    .filter((t: any) => t && typeof t.text === 'string' && t.text.trim())
    .map((t: any) => ({
      ...t,
      startMs: optionalNonnegativeInt(t.startMs),
      endMs: optionalNonnegativeInt(t.endMs),
      questionOrd: optionalNonnegativeInt(t.questionOrd),
    }))
    .sort((a: any, b: any) => {
      const av = a.startMs ?? Number.MAX_SAFE_INTEGER
      const bv = b.startMs ?? Number.MAX_SAFE_INTEGER
      return av - bv
    })
    .map((t: any) => ({
      ...(t.id == null ? {} : { id: `mt_${createHash('sha256').update(`${s.id}\0${t.id}`).digest('hex')}` }),
      sessionId: s.id,
      ord: 0,
      speaker: t.speaker === 'interviewer' ? 'interviewer' : 'candidate',
      text: String(t.text).slice(0, MAX_TEXT_LEN),
      questionOrd: t.questionOrd,
      startMs: t.startMs,
      endMs: t.endMs,
    }))

  if (rows.length === 0) return NextResponse.json({ saved: 0 })
  const saved = await prisma.$transaction(async (tx) => {
    // 評価確定・終了と同じ行をロックする。採番と発話追加も同じ処理内で行う。
    await tx.$queryRaw`SELECT id FROM mensetsu_sessions WHERE id = ${s.id} FOR NO KEY UPDATE`
    const current = await tx.mensetsuSession.findUnique({ where: { id: s.id } })
    if (!current) return { error: '面接が見つかりません', status: 404 }
    if (!current.consentedAt) return { error: '同意が必要です', status: 403 }
    if (current.purgeAfter && current.purgeAfter.getTime() <= Date.now()) return { error: 'この面接の記録は削除されています', status: 410 }
    const identified = rows.filter((row) => row.id)
    const existing = identified.length ? await tx.mensetsuTurn.findMany({
      where: { sessionId: s.id, id: { in: identified.map((row) => row.id!) } },
      select: { id: true, speaker: true, text: true, startMs: true, endMs: true, questionOrd: true },
    }) : []
    const seen = new Map<string, typeof rows[number] | typeof existing[number]>(existing.map((row) => [row.id, row]))
    const additions: typeof rows = []
    for (const row of rows) {
      const prior = row.id ? seen.get(row.id) : undefined
      if (prior) {
        if (['speaker', 'text', 'startMs', 'endMs', 'questionOrd'].some((key) =>
          prior[key as keyof typeof prior] !== row[key as keyof typeof row])) {
          return { error: '保存済みの発話と再送された内容が一致しません', status: 409 }
        }
      } else {
        additions.push(row)
        if (row.id) seen.set(row.id, row)
      }
    }
    // 応答だけが失われた再送は、評価確定後も保存済みと応答する。新規発話は追加しない。
    if (additions.length === 0) return { shouldEvaluate: false }
    if (current.evaluatedAt) return { error: 'この面接は評価済みです', status: 409 }
    if (!current.startedAt || !['live', 'completed', 'evaluating', 'aborted'].includes(current.status) ||
        (current.endedAt && Date.now() - current.endedAt.getTime() > GRACE_MS)) {
      return { error: 'この面接には発話を保存できません', status: 409 }
    }
    const last = await tx.mensetsuTurn.findFirst({
      where: { sessionId: s.id }, orderBy: { ord: 'desc' }, select: { ord: true },
    })
    additions.forEach((row, index) => { row.ord = (last?.ord ?? -1) + 1 + index })
    await tx.mensetsuTurn.createMany({ data: additions })
    const shouldEvaluate = !!current.endedAt && ['completed', 'aborted'].includes(current.status)
    // 評価中の実行権は保持する。評価処理自身が追加発話を照合して再評価する。
    if (current.status !== 'evaluating') {
      await tx.mensetsuSession.update({
        where: { id: s.id },
        data: {
          ...(shouldEvaluate ? { status: 'completed' } : {}),
          updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
        },
      })
    }
    return { shouldEvaluate }
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
  if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: saved.status })
  if (saved.shouldEvaluate) {
    const evaluation = runEvaluation(s.id).then((result) => {
      if (!result.ok) {
        if (result.status === 409) console.warn('[mensetsu] 追加発話後の評価は状態の変更で確定しませんでした', result.status)
        else console.error('[mensetsu] 追加発話後の自動評価を完了できませんでした', result.status)
      }
    }).catch(() => console.error('[mensetsu] 追加発話後の自動評価に失敗'))
    try { waitUntil(evaluation) } catch { await evaluation }
  }
  return NextResponse.json({ saved: rows.length })
}
