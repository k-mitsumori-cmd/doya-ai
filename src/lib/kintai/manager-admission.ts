import type { Prisma } from '@prisma/client'
import type { KintaiContext, KintaiMemberRole } from './types'

/** Hold the current member and employee rows while a mutation commits. */
export async function lockCurrentKintaiActor(
  tx: Prisma.TransactionClient,
  ctx: KintaiContext,
): Promise<KintaiMemberRole | null> {
  const rows = await tx.$queryRaw<{ role: string; status: string; isActive: boolean }[]>`
    SELECT m.role, m.status, e."isActive" AS "isActive"
    FROM "kintai_members" m
    JOIN "kintai_employees" e ON e."memberId" = m.id
    WHERE m.id = ${ctx.memberId}
      AND m."organizationId" = ${ctx.organizationId}
      AND m."userId" = ${ctx.userId}
      AND e.id = ${ctx.employeeId}
      AND e."organizationId" = ${ctx.organizationId}
    FOR UPDATE OF m, e
  `
  const actor = rows[0]
  if (actor?.status !== 'ACTIVE' || !actor.isActive) return null
  return actor.role === 'employee' || actor.role === 'manager' || actor.role === 'hr_admin' || actor.role === 'system_admin'
    ? actor.role
    : null
}

export async function lockCurrentKintaiManager(
  tx: Prisma.TransactionClient,
  ctx: KintaiContext,
): Promise<KintaiMemberRole | null> {
  const role = await lockCurrentKintaiActor(tx, ctx)
  return role === 'hr_admin' || role === 'system_admin' ? role : null
}
