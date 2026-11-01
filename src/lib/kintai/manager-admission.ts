import type { Prisma } from '@prisma/client'
import type { KintaiContext, KintaiMemberRole } from './types'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'

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
  // 入口で会社の役割の上限を当てた役割（ctx.role）より上には上げない（ROLES-2026-10-26.md §4。旗が off なら ctx.role は DB の役割と同じ）
  const role = ctx.role === undefined ? actor.role : lowerToolRole('kintai', actor.role, ctx.role)
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
