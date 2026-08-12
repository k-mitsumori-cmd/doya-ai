export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/mensetsu/live/[token]/feedback — 応募者本人へのフィードバック開示（F5-4）
//
// ⚠️ このルートは未認証の応募者が叩く。返してよいのは candidateFeedback の
//    本文だけ。スコア・推薦度・採用担当者向けレポート・ルーブリック・他候補者の
//    情報は絶対に返さない（応募者向けと担当者向けは別文面で生成してある）。
// ⚠️ 既定は非開示。組織が discloseToCandidate をオンにしたときだけ返す。
import { NextRequest, NextResponse } from 'next/server'
import { loadSessionByToken } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  if (!s.organization.discloseToCandidate) {
    return NextResponse.json({ disclosed: false, ready: false })
  }
  // 評価が終わるまでは何も出さない（面接直後は担当者側の評価がまだ走っていない）
  if (s.status !== 'evaluated' || !s.candidateFeedback) {
    return NextResponse.json({ disclosed: true, ready: false })
  }

  // ⚠️ ここで返すのは本文のみ。verdict / scores を足さないこと
  return NextResponse.json({ disclosed: true, ready: true, feedback: s.candidateFeedback })
}
