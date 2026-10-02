import { prisma } from '@/lib/prisma'

export type OrganizationService = 'quote' | 'mensetsu' | 'aishodan'

/** 組織枠を負担する契約者。オーナーがいなければ無料扱いに倒す。 */
export async function getOrganizationOwnerUserId(service: OrganizationService, organizationId: string): Promise<string | null> {
  const query = {
    where: { organizationId, status: 'ACTIVE', role: 'owner', userId: { not: null } },
    orderBy: { createdAt: 'asc' as const },
    select: { userId: true },
  }
  const owner = service === 'quote' ? await prisma.quoteMember.findFirst(query)
    : service === 'mensetsu' ? await prisma.mensetsuMember.findFirst(query)
      : await prisma.aishodanMember.findFirst(query)
  return owner?.userId ?? null
}

export async function getOrganizationBilling(service: OrganizationService, organizationId: string) {
  const ownerUserId = await getOrganizationOwnerUserId(service, organizationId)
  const owner = ownerUserId ? await prisma.user.findUnique({ where: { id: ownerUserId }, select: { plan: true } }) : null
  return { ownerUserId, plan: owner?.plan ?? 'FREE' }
}
