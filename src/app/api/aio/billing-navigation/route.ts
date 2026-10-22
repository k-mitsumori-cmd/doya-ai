export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { privateApiJson } from '@/lib/private-api-response'
import { getAioContext } from '@/lib/aio/access'
import { getAioBilling } from '@/lib/aio/billing'
import { ROLE_HIERARCHY } from '@/lib/aio/types'
import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'

/** This is navigation context, not an authorization to change the User-wide subscription. */
export async function GET(request: NextRequest) {
  const actorHeader = request.headers.get('X-Aio-Actor-Id')
  if (!actorHeader || actorHeader.length > 128) return privateApiJson({ code: 'ACTOR_REQUIRED' }, { status: 401 })
  try {
    const session = await getServerSession(authOptions)
    let actorId = (session?.user as { id?: string } | undefined)?.id
    if (!actorId && session?.user?.email) {
      actorId = (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id
    }
    if (!actorId) return privateApiJson({ code: 'ACTOR_REQUIRED' }, { status: 401 })
    if (actorId !== actorHeader) return privateApiJson({ code: 'ACTOR_CHANGED' }, { status: 409 })
    const requested = request.nextUrl.searchParams.getAll('org')
    if (requested.length > 1 || requested.length === 1 && !validWorkspaceSlug(requested[0])) return privateApiJson({ code: 'ORG_INVALID' }, { status: 400 })
    const rows = await prisma.aioMember.findMany({
      where: { userId: actorId, status: 'ACTIVE', role: { in: Object.keys(ROLE_HIERARCHY) } },
      include: { organization: true }, orderBy: { createdAt: 'asc' }, take: 513,
    })
    if (rows.length > 512) return privateApiJson({ code: 'ORG_READ_UNAVAILABLE' }, { status: 503 })
    const memberships = rows.map(row => ({ id: row.organization.id, slug: row.organization.slug,
      name: row.organization.name, role: row.role }))
    if (new Set(memberships.map(row => row.id)).size !== memberships.length ||
      new Set(memberships.map(row => row.slug)).size !== memberships.length) return privateApiJson({ code: 'ORG_READ_UNAVAILABLE' }, { status: 503 })
    if (!requested.length) return privateApiJson({ service: 'aio', actorId, memberships, current: null })
    const slug = requested[0]!
    const membership = memberships.find(row => row.slug === slug)
    if (!membership) return privateApiJson({ code: 'ORG_NOT_FOUND' }, { status: 403 })
    const context = await getAioContext(slug)
    if (!context || context.userId !== actorId || context.organizationId !== membership.id || context.organizationSlug !== slug ||
      context.role !== membership.role) return privateApiJson({ code: 'ORG_CHANGED' }, { status: 409 })
    const billing = await getAioBilling(prisma, context.organizationId)
    if (!billing) return privateApiJson({ code: 'BILLING_OWNER_UNAVAILABLE' }, { status: 409 })
    return privateApiJson({ service: 'aio', actorId, memberships,
      current: { ...membership, plan: billing.plan, canManageBilling: membership.role === 'owner' } })
  } catch { return privateApiJson({ code: 'ORG_READ_UNAVAILABLE' }, { status: 503 }) }
}
