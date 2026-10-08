import type { Prisma, PrismaClient } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { prisma } from '@/lib/prisma'

/** All department mutations share the organization lock, including parent-chain validation. */
export async function runHrDepartmentMutation<T>(
  ctx: HrContext,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  db: PrismaClient = prisma,
): Promise<{ allowed: false } | { allowed: true; value: T }> {
  return db.$transaction(async tx => {
    const organizations = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "hr_organizations" WHERE id = ${ctx.organizationId} FOR UPDATE
    `
    if (organizations.length !== 1) return { allowed: false as const }
    // Recheck and hold the current membership after waiting for another mutation.
    const members = await tx.$queryRaw<{ role: string; status: string }[]>`
      SELECT role, status FROM "hr_organization_members"
      WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId} AND "userId" = ${ctx.userId}
      FOR UPDATE
    `
    const member = members[0]
    if (member?.status !== 'ACTIVE' || (member.role !== 'ADMIN' && member.role !== 'OWNER')) return { allowed: false as const }
    return { allowed: true as const, value: await action(tx) }
  }, { maxWait: 10000, timeout: 15000 })
}
