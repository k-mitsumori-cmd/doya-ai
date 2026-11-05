export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTrialEligible, TRIAL_USER_SELECT } from '@/lib/trial'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { TEAM_TRIAL_DAYS } from '@/lib/pricing-v2/plans'

// GET /api/stripe/trial-eligibility
// 「初月無料」訴求の表示出し分け用。未ログイン訪問者は将来の新規顧客なので eligible:true。
// ログイン済みは DB の契約状態と Stripe 履歴で判定（有料の利用者・再契約者は false）。
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    // 新しい料金の対象の人には、初月無料のプランがない（チームに付けない。2026-11-05 本人の決定。今のプロの新しい申し込みは止まる）。
    // 全ツールの「初月無料」の表示は、この応答で決まる。旗が off（と preview の対象でない人）は今までどおり
    if (TEAM_TRIAL_DAYS <= 0 && isNewPricingEnabledFor(session?.user?.email ?? null)) {
      return NextResponse.json({ eligible: false }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!session?.user?.email) {
      return NextResponse.json({ eligible: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: TRIAL_USER_SELECT,
    })
    const eligible = await isTrialEligible({
      email: session.user.email,
      stripeCustomerId: user?.stripeCustomerId,
      plan: user?.plan,
      servicePlans: user?.serviceSubscriptions?.map(s => s.plan),
    })
    return NextResponse.json({ eligible }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // 表示上は訴求を抑止するが、対象外ではなく判定不能として返す。
    return NextResponse.json({ eligible: false, code: 'TRIAL_CHECK_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
