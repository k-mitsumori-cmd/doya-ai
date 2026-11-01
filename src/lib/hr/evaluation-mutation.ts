import type { Prisma, PrismaClient } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'

/** Keep live membership locked throughout a self/evaluator/administrator mutation. */
export async function runHrEvaluationMutation<T>(db: PrismaClient, ctx: HrContext, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    const organizations = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM hr_organizations WHERE id = ${ctx.organizationId} FOR UPDATE
    `
    if (organizations.length !== 1) return { allowed: false as const }
    const members = await tx.$queryRaw<{ role: string; status: string; employeeId: string | null }[]>`
      SELECT role, status, "employeeId" FROM hr_organization_members
      WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId} AND "userId" = ${ctx.userId}
      FOR UPDATE
    `
    const member = members[0]
    if (member?.status !== 'ACTIVE' || !['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(member.role) || lowerToolRole('hr', member.role, ctx.role) !== ctx.role ||
      member.employeeId !== ctx.employeeId) return { allowed: false as const }
    return { allowed: true as const, value: await action(tx) }
  }, { maxWait: 10000, timeout: 15000 })
}

/** Lock the organization and live membership before administrator evaluation writes. */
export async function runHrEvaluationAdminMutation<T>(db: PrismaClient, ctx: HrContext, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async tx => {
    const organizations = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM hr_organizations WHERE id = ${ctx.organizationId} FOR UPDATE
    `
    if (organizations.length !== 1) return { allowed: false as const }
    const members = await tx.$queryRaw<{ role: string; status: string }[]>`
      SELECT role, status FROM hr_organization_members
      WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId} AND "userId" = ${ctx.userId}
      FOR UPDATE
    `
    const member = members[0]
    if (member?.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(lowerToolRole('hr', member.role, ctx.role) ?? '')) return { allowed: false as const }
    return { allowed: true as const, value: await action(tx) }
  }, { maxWait: 10000, timeout: 15000 })
}
