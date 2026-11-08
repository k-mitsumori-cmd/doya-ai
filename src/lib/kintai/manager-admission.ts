import type { Prisma } from '@prisma/client'
import type { KintaiContext, KintaiMemberRole } from './types'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { lockKintaiEmployeeAdmission } from './employee-admission'

/** Pin current company authority before the organization/member/employee locks.
 * All callers use this single order, including shared admission transactions. */
export async function lockCurrentKintaiActor(
  tx: Prisma.TransactionClient,
  ctx: KintaiContext,
): Promise<KintaiMemberRole | null> {
  const companyCeiling = await ceilToolRole({ tool: 'kintai', userId: ctx.userId, organizationId: ctx.organizationId, toolRole: 'system_admin' }, tx)
  if (!companyCeiling) return null
  await lockKintaiEmployeeAdmission(tx, ctx.organizationId)
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
  // Preserve the original request ceiling while rechecking current company authority.
  const limited = lowerToolRole('kintai', actor.role, companyCeiling)
  const role = limited && (ctx.role === undefined ? limited : lowerToolRole('kintai', limited, ctx.role))
  return role === 'employee' || role === 'manager' || role === 'hr_admin' || role === 'system_admin'
    ? role
    : null
}

export async function lockCurrentKintaiManager(
  tx: Prisma.TransactionClient,
  ctx: KintaiContext,
): Promise<KintaiMemberRole | null> {
  const role = await lockCurrentKintaiActor(tx, ctx)
  return role === 'hr_admin' || role === 'system_admin' ? role : null
}
