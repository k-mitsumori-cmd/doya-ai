import type { Prisma } from '@prisma/client'
import { getKintaiEmployeeLimitByUserPlan } from '@/lib/pricing'

/** 従業員の追加・再有効化を組織ごとに直列化する。呼出元は同じtxで保存する。 */
export async function lockKintaiEmployeeAdmission(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const organizations = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "kintai_organizations" WHERE id = ${organizationId} FOR UPDATE
  `
  if (organizations.length === 0) throw new Error('Kintai organization not found')
}

/** 組織ロック取得後に呼ぶ。満員なら上限を返し、追加できるならnull。 */
export async function reachedKintaiEmployeeLimit(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number | null> {
  const owner = await tx.kintaiMember.findFirst({
    where: { organizationId, role: 'system_admin' },
    select: { userId: true },
  })
  const ownerUser = owner ? await tx.user.findUnique({
    where: { id: owner.userId },
    select: { plan: true },
  }) : null
  const limit = getKintaiEmployeeLimitByUserPlan(ownerUser?.plan || 'FREE')
  if (limit < 0) return null

  const activeCount = await tx.kintaiEmployee.count({
    where: { organizationId, isActive: true },
  })
  return activeCount >= limit ? limit : null
}
