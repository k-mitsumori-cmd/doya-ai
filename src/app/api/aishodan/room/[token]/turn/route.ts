export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/turn — 発話ログをまとめて保存
// クライアントは数件ずつまとめて送る（1発話ごとに叩くとレイテンシ予算を食う）。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadGuestSession } from '@/lib/aishodan/session'
import { enqueueEvaluation } from '@/lib/aishodan/evaluation-task'
import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

type Ctx = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  // ⚠️ 開始済みの商談では終了後でもログの保存だけは受け付ける。
  //    ここを弾くと、終了直前の発話が落ちて記録に穴があく（mensetsu で踏んだ）。
  const turns: any[] = Array.isArray(body?.turns) ? body.turns.slice(0, 50) : []
  if (turns.length === 0) return NextResponse.json({ saved: 0 })

  if (turns.some((t) => t?.id != null && (typeof t.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(t.id)))) {
    return NextResponse.json({ error: '発話の識別子が正しくありません。' }, { status: 400 })
  }
  const rows: Prisma.AishodanTurnCreateManyInput[] = turns
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({
      ...(t.id == null ? {} : { id: `ast_${createHash('sha256').update(`${s.id}\0${t.id}`).digest('hex')}` }),
      sessionId: s.id,
      ord: 0,
      speaker: t.speaker === 'ai' ? 'ai' : 'guest',
      text: String(t.text).slice(0, 8000),
      phase: typeof t.phase === 'string' && t.phase ? t.phase.slice(0, 40) : (t.id == null ? s.currentPhase : null),
      startMs: Number.isSafeInteger(Number(t.startMs)) && Number(t.startMs) >= 0 && Number(t.startMs) <= 2147483647 ? Number(t.startMs) : 0,
    }))
  if (rows.length === 0) return NextResponse.json({ saved: 0 })
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${s.id} FOR NO KEY UPDATE`
    const current = await tx.aishodanSession.findUnique({ where: { id: s.id } })
    if (!current || current.guestId !== s.guestId || current.roomId !== s.roomId || current.organizationId !== s.organizationId) {
      return { error: '商談が見つかりません。', status: 404 }
    }
    if (!current.consentedAt) return { error: '先に同意が必要です。', status: 403 }
    if (current.purgeAfter && current.purgeAfter.getTime() <= Date.now()) {
      return { error: 'この商談の記録は保存期間が終了しています。', status: 410 }
    }
    const live = current.status === 'live' && !current.endedAt
    const ended = ['completed', 'evaluated', 'aborted'].includes(current.status) && !!current.endedAt
    if (!current.startedAt || (!live && !ended)) {
      return { error: 'この商談は発話を保存できる状態ではありません。', status: 409 }
    }
    const identified = rows.filter((row) => row.id)
    const existing = identified.length ? await tx.aishodanTurn.findMany({
      where: { sessionId: s.id, id: { in: identified.map((row) => row.id!) } },
      select: { id: true, speaker: true, text: true, phase: true, startMs: true },
    }) : []
    const seen = new Map<string, typeof rows[number] | typeof existing[number]>(existing.map((row) => [row.id, row]))
    const additions: typeof rows = []
    for (const row of rows) {
      const prior = row.id ? seen.get(row.id) : undefined
      if (prior) {
        if (['speaker', 'text', 'phase', 'startMs'].some((key) =>
          prior[key as keyof typeof prior] !== row[key as keyof typeof row])) {
          return { error: '保存済みの発話と再送された内容が一致しません。', status: 409 }
        }
      } else {
        additions.push(row)
        if (row.id) seen.set(row.id, row)
      }
    }
    if (additions.length) {
      const last = await tx.aishodanTurn.findFirst({
        where: { sessionId: s.id }, orderBy: { ord: 'desc' }, select: { ord: true },
      })
      additions.forEach((row, index) => { row.ord = (last?.ord ?? -1) + 1 + index })
      await tx.aishodanTurn.createMany({ data: additions })
      // 旧クライアントの保存と終了は別要求で、終了が先に届く場合がある。
      // 後から実際の回答が揃った商談を中断のままにしない。
      const recovered = current.status === 'aborted' && !!current.startedAt && !!current.endedAt &&
        await tx.aishodanTurn.count({ where: { sessionId: s.id, speaker: 'guest' } }) >= 2
      const priorOutcome = current.status === 'evaluated' ? await tx.aishodanOutcome.findUnique({ where: { sessionId: s.id }, select: { overriddenAt: true } }) : null
      const staleAiOutcome = current.status === 'evaluated' && !priorOutcome?.overriddenAt
      const revision = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1))
      await tx.aishodanSession.update({ where: { id: s.id }, data: {
        ...(recovered || staleAiOutcome ? { status: 'completed' } : {}),
        updatedAt: revision,
      } })
      if (current.endedAt && (recovered || ['completed', 'evaluated'].includes(current.status))) {
        await enqueueEvaluation(tx, current.id, current.organizationId, revision)
      }
    }
    return { saved: rows.length }
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ saved: result.saved })
}
