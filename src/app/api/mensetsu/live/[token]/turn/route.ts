export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/turn — 発話ログ追記（F4-1）
// クライアントが Realtime のイベントからテキストを拾い、まとめて送る。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

const MAX_TURNS_PER_CALL = 50
const MAX_TEXT_LEN = 5000

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })
  // ⚠️ 他の live/* ルートと同じく assertUsable を通す。
  //    以前は status==='evaluated' しか弾いておらず、面接終了後・期限切れ後でも
  //    逐語ログを追記できた。評価の根拠として引用されるデータなので、
  //    書き込める窓は面接が有効な間だけに閉じる。
  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const body = await req.json().catch(() => ({}))
  const incoming = Array.isArray(body?.turns) ? body.turns.slice(0, MAX_TURNS_PER_CALL) : []
  if (incoming.length === 0) return NextResponse.json({ saved: 0 })

  const last = await prisma.mensetsuTurn.findFirst({
    where: { sessionId: s.id },
    orderBy: { ord: 'desc' },
    select: { ord: true },
  })
  let ord = (last?.ord ?? -1) + 1

  const rows = incoming
    .filter((t: any) => t && typeof t.text === 'string' && t.text.trim())
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
