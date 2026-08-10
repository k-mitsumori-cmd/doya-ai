export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/aishodan/room/[token]/scheduling — 日程調整ボタンが押されたことを記録
//
// ⚠️ 記録するだけ。遷移先URLはここでは返さない。
//    クライアントは既に /api/aishodan/room/[token] で受け取ったURLを持っており、
//    ここでURLを返す設計にすると「記録APIが任意の遷移先を返す」形になって
//    オープンリダイレクトの温床になる。
//
// ⚠️ 一次商談の成果はここ。押されたかどうかが分からないと、
//    商談が次につながったのかを誰も判断できない。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadGuestSession } from '@/lib/aishodan/session'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  // ⚠️ 終了後に押されることもある（お礼画面のボタン）。状態では弾かない。
  //    最初に押した時刻を残す（押し直しで上書きしない）。
  if (!s.schedulingClickedAt) {
    await prisma.aishodanSession.update({
      where: { id: s.id },
      data: { schedulingClickedAt: new Date() },
    })
  }
  return NextResponse.json({ ok: true })
}
