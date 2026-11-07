// Service pricing uses the same contract classification as the canonical pricing page.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { resolvePricingView } from '@/lib/pricing-v2/view.server'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email ?? null
    const newPricing = isNewPricingEnabledFor(email)
    // Off does not require another plan lookup. Enabled/current means classification failed.
    const pricingView = newPricing ? await resolvePricingView(email) : 'current'
    if (newPricing && pricingView === 'current') {
      return NextResponse.json({ error: 'PRICING_STATUS_UNAVAILABLE' }, { status: 503, headers })
    }
    return NextResponse.json({ newPricing, pricingView }, { headers })
  } catch {
    console.error('[pricing/status] could not resolve the pricing view')
    return NextResponse.json({ error: 'PRICING_STATUS_UNAVAILABLE' }, { status: 503, headers })
  }
}
