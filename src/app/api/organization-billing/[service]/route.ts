export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getQuoteContext } from '@/lib/quote/access'
import { getMensetsuContext } from '@/lib/mensetsu/access'
import { getAishodanContext } from '@/lib/aishodan/access'
import { getOrganizationBilling, type OrganizationService } from '@/lib/organization-billing'

type Ctx = { params: Promise<{ service: string }> }
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(req: NextRequest, context: Ctx) {
  const { service } = await context.params
  if (!['quote', 'mensetsu', 'aishodan'].includes(service)) {
    return NextResponse.json({ error: 'サービスが見つかりません' }, { status: 404, headers: privateHeaders })
  }
  try {
    const slug = new URL(req.url).searchParams.get('org')?.trim() || undefined
    const ctx = service === 'quote' ? await getQuoteContext(slug)
      : service === 'mensetsu' ? await getMensetsuContext(slug)
        : await getAishodanContext(slug)
    if (!ctx) return NextResponse.json({ error: '組織を確認できませんでした' }, { status: 403, headers: privateHeaders })

    const billing = await getOrganizationBilling(service as OrganizationService, ctx.organizationId)
    return NextResponse.json({
      organizationId: ctx.organizationId,
      plan: billing.plan,
      canManageBilling: ctx.role === 'owner' && ctx.userId === billing.ownerUserId,
    }, { headers: privateHeaders })
  } catch {
    return NextResponse.json({ error: '組織の契約を確認できませんでした' }, { status: 503, headers: privateHeaders })
  }
}
