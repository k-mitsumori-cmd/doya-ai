export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getQuoteContext } from '@/lib/quote/access'
import { getMensetsuContext } from '@/lib/mensetsu/access'
import { getAishodanContext } from '@/lib/aishodan/access'
import { getOrganizationBilling, type OrganizationService } from '@/lib/organization-billing'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { organizationSelection } from '@/lib/organization-workspace-selection'

type Ctx = { params: Promise<{ service: string }> }
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(req: NextRequest, context: Ctx) {
  const { service } = await context.params
  if (!['quote', 'mensetsu', 'aishodan'].includes(service)) {
    return NextResponse.json({ error: 'サービスが見つかりません' }, { status: 404, headers: privateHeaders })
  }
  try {
    const strict = service === 'aishodan' || service === 'quote' && req.headers.has('x-doya-workspace-actor')
    const selected = strict ? organizationSelection(new URL(req.url).search) : null
    if (strict) {
      const actor = (await getServerSession(authOptions))?.user?.id
      if (!actor) return NextResponse.json({ error: 'ログインしてください' }, { status: 401, headers: privateHeaders })
      if (req.headers.get('x-doya-workspace-actor') !== actor) return NextResponse.json({ error: 'ログイン状態を確認してください' }, { status: 409, headers: privateHeaders })
      if (selected?.kind !== 'selected') return NextResponse.json({ error: '組織の指定を確認してください' }, { status: 400, headers: privateHeaders })
    }
    const slug = new URL(req.url).searchParams.get('org')?.trim() || undefined
    const ctx = service === 'quote' ? await getQuoteContext(slug)
      : service === 'mensetsu' ? await getMensetsuContext(slug)
        : await getAishodanContext(slug)
    if (!ctx) return NextResponse.json({ error: '組織を確認できませんでした' }, { status: 403, headers: privateHeaders })
    if (strict && (ctx.userId !== req.headers.get('x-doya-workspace-actor') || ctx.organizationSlug !== (selected?.kind === 'selected' ? selected.slug : ''))) return NextResponse.json({ error: '組織を確認できませんでした' }, { status: 409, headers: privateHeaders })

    const billing = await getOrganizationBilling(service as OrganizationService, ctx.organizationId)
    return NextResponse.json({
      organizationId: ctx.organizationId,
      ...(strict ? { actorId: ctx.userId, organizationSlug: ctx.organizationSlug } : {}),
      plan: billing.plan,
      canManageBilling: ctx.role === 'owner' && ctx.userId === billing.ownerUserId,
    }, { headers: privateHeaders })
  } catch {
    return NextResponse.json({ error: '組織の契約を確認できませんでした' }, { status: 503, headers: privateHeaders })
  }
}
