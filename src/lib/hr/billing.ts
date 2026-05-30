import { prisma } from '@/lib/prisma'

// ============================================
// ドヤHR SaaS課金・プラン制限
// ============================================

export type HrPlan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

export interface PlanLimits {
  maxEmployees: number   // -1 = 無制限
  maxAiUsage: number     // -1 = 無制限（月次）
  maxMembers: number     // -1 = 無制限
}

/**
 * プランごとの制限値を返す
 * FREE:5名/3AI/2メンバー, STARTER:30/30/5, PRO:100/-1/-1, ENTERPRISE:-1/-1/-1
 */
export function getOrgPlanLimits(plan: string): PlanLimits {
  switch (plan.toUpperCase()) {
    case 'ENTERPRISE':
      return { maxEmployees: -1, maxAiUsage: -1, maxMembers: -1 }
    case 'PRO':
      return { maxEmployees: 100, maxAiUsage: -1, maxMembers: -1 }
    case 'STARTER':
    case 'LIGHT':
      return { maxEmployees: 30, maxAiUsage: 30, maxMembers: 5 }
    case 'FREE':
    default:
      return { maxEmployees: 5, maxAiUsage: 3, maxMembers: 2 }
  }
}

/**
 * 組織のプランを、OWNER の User.plan（グローバル）から取得する。
 * 統一プラン方針: プラン判定は User.plan が唯一の正。プロ1契約で全サービス解放されるため、
 * オーナーが ¥9,980 プロを契約していれば組織全体で HR もプロ扱いになる。
 * （UserServiceSubscription.plan はサービス別の使用量管理用で、プラン判定には使わない）
 */
export async function getOrgPlan(organizationId: string): Promise<string> {
  // 組織のOWNERを取得
  const owner = await prisma.hrOrganizationMember.findFirst({
    where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
  })
  if (!owner) return 'FREE'

  // OWNER の User.plan（グローバル）をプランの正とする
  const user = await prisma.user.findUnique({
    where: { id: owner.userId },
    select: { plan: true },
  })

  return user?.plan || 'FREE'
}

/**
 * 従業員追加が可能か確認
 * @returns null = OK, string = エラーメッセージ
 */
export async function checkEmployeeLimit(organizationId: string): Promise<string | null> {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return null

  const plan = await getOrgPlan(organizationId)
  const limits = getOrgPlanLimits(plan)
  if (limits.maxEmployees === -1) return null

  const count = await prisma.hrEmployee.count({
    where: { organizationId, status: 'ACTIVE' },
  })

  if (count >= limits.maxEmployees) {
    return `従業員数の上限（${limits.maxEmployees}名）に達しています。プランをアップグレードしてください。`
  }

  return null
}

/**
 * AI使用回数の制限チェック（月次リセット付き）
 * @returns null = OK, string = エラーメッセージ
 */
export async function checkAiUsageLimit(organizationId: string): Promise<string | null> {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return null

  const plan = await getOrgPlan(organizationId)
  const limits = getOrgPlanLimits(plan)
  if (limits.maxAiUsage === -1) return null

  const org = await prisma.hrOrganization.findUnique({
    where: { id: organizationId },
    select: { aiUsageCount: true, aiUsageResetAt: true },
  })
  if (!org) return '組織が見つかりません'

  // 月次リセット判定
  const now = new Date()
  const resetAt = org.aiUsageResetAt ? new Date(org.aiUsageResetAt) : new Date(0)
  const needsReset =
    now.getFullYear() !== resetAt.getFullYear() ||
    now.getMonth() !== resetAt.getMonth()

  if (needsReset) {
    // リセット実行
    await prisma.hrOrganization.update({
      where: { id: organizationId },
      data: { aiUsageCount: 0, aiUsageResetAt: now },
    })
    return null // リセット後は0なのでOK
  }

  if (org.aiUsageCount >= limits.maxAiUsage) {
    return `AI機能の月間利用回数（${limits.maxAiUsage}回）に達しています。プランをアップグレードしてください。`
  }

  return null
}

/**
 * AI使用カウントをインクリメント
 */
export async function incrementAiUsage(organizationId: string): Promise<void> {
  await prisma.hrOrganization.update({
    where: { id: organizationId },
    data: { aiUsageCount: { increment: 1 } },
  })
}

/**
 * メンバー招待が可能か確認
 * @returns null = OK, string = エラーメッセージ
 */
export async function checkMemberLimit(organizationId: string): Promise<string | null> {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return null

  const plan = await getOrgPlan(organizationId)
  const limits = getOrgPlanLimits(plan)
  if (limits.maxMembers === -1) return null

  const memberCount = await prisma.hrOrganizationMember.count({
    where: { organizationId, status: 'ACTIVE' },
  })

  if (memberCount >= limits.maxMembers) {
    return `メンバー数の上限（${limits.maxMembers}名）に達しています。プランをアップグレードしてください。`
  }

  return null
}
