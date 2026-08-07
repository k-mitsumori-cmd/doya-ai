export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/turn — 発話ログ追記（F4-1）
// クライアントが Realtime のイベントからテキストを拾い、まとめて送る。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadSessionByToken } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

const MAX_TURNS_PER_CALL = 50
const MAX_TEXT_LEN = 5000

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  // ⚠️ ここで assertUsable をそのまま使うと、面接中に期限を跨いだり
  //    担当者が close した瞬間から 4xx になり、送信中だった発話が
  //    クライアント側で破棄されて逐語ログがぶつ切りになる。
  //    書き込みを閉じるのは「評価が済んだ後」と「終了から十分に経った後」に限定する。
  //    （評価前の追記は面接中にも可能なので、ここを厳しくしても偽装は防げない）
  const GRACE_MS = 10 * 60 * 1000
  if (s.evaluatedAt) {
    return NextResponse.json({ error: 'この面接は評価済みです' }, { status: 409 })
  }
  if (s.endedAt && Date.now() - s.endedAt.getTime() > GRACE_MS) {
    return NextResponse.json({ error: 'この面接は終了しています' }, { status: 409 })
  }
  if (s.purgeAfter && s.purgeAfter.getTime() < Date.now()) {
    return NextResponse.json({ error: 'この面接の記録は削除されています' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({}))
  const incoming = Array.isArray(body?.turns) ? body.turns.slice(0, MAX_TURNS_PER_CALL) : []
  if (incoming.length === 0) return NextResponse.json({ saved: 0 })

  const last = await prisma.mensetsuTurn.findFirst({
    where: { sessionId: s.id },
    orderBy: { ord: 'desc' },
    select: { ord: true },
  })
  let ord = (last?.ord ?? -1) + 1

  // ⚠️ 到着順ではなく「話し始めた時刻」で並べてから採番する。
  //    発話は読み上げ／認識が終わって初めて確定するため、到着順のままだと
  //    長い発話が後ろにずれ、逐語ログが会話の順序として読めなくなる
  //    （実際に本番で、面接官の冒頭挨拶より応募者の相槌が先に並んだ）。
  //    評価AIもこのログを根拠に読むため、順序が狂うと採点が歪む。
  const rows = incoming
    .filter((t: any) => t && typeof t.text === 'string' && t.text.trim())
    .sort((a: any, b: any) => {
      const av = Number.isFinite(Number(a?.startMs)) ? Number(a.startMs) : Number.MAX_SAFE_INTEGER
      const bv = Number.isFinite(Number(b?.startMs)) ? Number(b.startMs) : Number.MAX_SAFE_INTEGER
      return av - bv
    })
    .map((t: any) => ({
      sessionId: s.id,
      ord: ord++,
      speaker: t.speaker === 'interviewer' ? 'interviewer' : 'candidate',
      text: String(t.text).slice(0, MAX_TEXT_LEN),
      questionOrd: Number.isFinite(Number(t.questionOrd)) ? Number(t.questionOrd) : null,
      startMs: Number.isFinite(Number(t.startMs)) ? Number(t.startMs) : null,
      endMs: Number.isFinite(Number(t.endMs)) ? Number(t.endMs) : null,
    }))

  if (rows.length === 0) return NextResponse.json({ saved: 0 })
  await prisma.mensetsuTurn.createMany({ data: rows })
  return NextResponse.json({ saved: rows.length })
}
