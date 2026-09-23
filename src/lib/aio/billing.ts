import type { Prisma } from '@prisma/client'

/** Resolve the unique active organization owner; never fall back to the acting member. */
export async function getAioBilling(db: Pick<Prisma.TransactionClient, 'aioMember' | 'user'>, organizationId: string) {
  const owners = await db.aioMember.findMany({
    where: { organizationId, role: 'owner', status: 'ACTIVE', userId: { not: null } },
    select: { userId: true }, take: 2,
  })
  if (owners.length !== 1) return null
  const user = await db.user.findUnique({ where: { id: owners[0].userId! }, select: { plan: true } })
  return user ? { plan: user.plan || 'FREE' } : null
}
