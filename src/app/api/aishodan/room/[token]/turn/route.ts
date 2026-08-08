export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/turn — 発話ログをまとめて保存
// クライアントは数件ずつまとめて送る（1発話ごとに叩くとレイテンシ予算を食う）。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadGuestSession } from '@/lib/aishodan/session'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  // ⚠️ 終了後でもログの保存だけは受け付ける。
  //    ここを弾くと、終了直前の発話が落ちて記録に穴があく（mensetsu で踏んだ）。
  const turns: any[] = Array.isArray(body?.turns) ? body.turns.slice(0, 50) : []
  if (turns.length === 0) return NextResponse.json({ saved: 0 })

  const last = await prisma.aishodanTurn.findFirst({
    where: { sessionId: s.id },
    orderBy: { ord: 'desc' },
    select: { ord: true },
  })
  let ord = (last?.ord ?? -1) + 1

  const rows = turns
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({
      sessionId: s.id,
      ord: ord++,
      speaker: t.speaker === 'ai' ? 'ai' : 'guest',
      text: String(t.text).slice(0, 8000),
      phase: t.phase ? String(t.phase).slice(0, 40) : s.currentPhase,
      // ⚠️ 発話の「開始」時刻。終了時刻で並べると、長いAI発話が短い相槌より後ろにずれる
      startMs: Number.isFinite(Number(t.startMs)) ? Math.max(0, Math.round(Number(t.startMs))) : 0,
    }))

  if (rows.length === 0) return NextResponse.json({ saved: 0 })
  await prisma.aishodanTurn.createMany({ data: rows })
  // クライアントは saved の件数で送信済みキューを詰める
  return NextResponse.json({ saved: rows.length })
}
