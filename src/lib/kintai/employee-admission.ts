import type { Prisma } from '@prisma/client'
import { getKintaiEmployeeLimitByUserPlan, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { tierFrom } from '@/lib/plan-utils'

export type KintaiEmployeeLimit = { limit: number; ownerUserId: string | null; upgradeAvailable: boolean }

export function kintaiEmployeeLimitPayload(reached: KintaiEmployeeLimit, actorUserId: string) {
  const canManageBilling = reached.ownerUserId === actorUserId
  return {
    error: `従業員数が上限（${reached.limit}名）に達しています。${!canManageBilling ? '組織の契約者に利用枠の確認を依頼してください。' : reached.upgradeAvailable ? 'プランを変更すると上限を増やせます。' : '追加をご希望の場合はお問い合わせください。'}`,
    code: 'KINTAI_EMPLOYEE_LIMIT',
    canManageBilling,
    upgradeAvailable: reached.upgradeAvailable,
    ...(canManageBilling ? reached.upgradeAvailable ? { upgradeUrl: '/kintai/pricing' } : { contactUrl: HIGH_USAGE_CONTACT_URL } : {}),
  }
}

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
): Promise<KintaiEmployeeLimit | null> {
  const owner = await tx.kintaiMember.findFirst({
    where: { organizationId, role: 'system_admin' },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  const ownerUser = owner ? await tx.user.findUnique({
    where: { id: owner.userId },
    select: { plan: true },
  }) : null
  const ownerPlan = ownerUser?.plan || 'FREE'
  const limit = getKintaiEmployeeLimitByUserPlan(ownerPlan)
  if (limit < 0) return null

  const activeCount = await tx.kintaiEmployee.count({
    where: { organizationId, isActive: true },
  })
  return activeCount >= limit ? { limit, ownerUserId: owner?.userId || null, upgradeAvailable: ['GUEST', 'FREE', 'LIGHT'].includes(tierFrom(ownerPlan)) } : null
}
