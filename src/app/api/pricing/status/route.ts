// ============================================
// この人に新しい料金を出すか /api/pricing/status
// ============================================
// 各ツールの料金ページ（UnifiedPricingPlans）が、今のプロ（9,980円）の申し込みボタンの代わりに、
// 新しい料金ページ（/pricing）への案内を出すかを決めるのに使う。DB は読まない（旗とメールだけ）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'

export async function GET() {
  const session = await getServerSession(authOptions).catch(() => null)
  return NextResponse.json({ newPricing: isNewPricingEnabledFor(session?.user?.email ?? null) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
