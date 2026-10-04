import type { Prisma } from '@prisma/client'

/** An organization uses its one active owner's plan, never the acting member's plan. */
export async function getShodanBilling(db: Pick<Prisma.TransactionClient, 'shodanMember' | 'user'>, organizationId: string) {
  const owners = await db.shodanMember.findMany({
    where: { organizationId, role: 'owner', status: 'ACTIVE', userId: { not: null } },
    select: { userId: true }, take: 2,
  })
  if (owners.length !== 1) return null
  const ownerUserId = owners[0].userId!
  const owner = await db.user.findUnique({ where: { id: ownerUserId }, select: { plan: true } })
  return owner ? { ownerUserId, plan: owner.plan || 'FREE' } : null
}
