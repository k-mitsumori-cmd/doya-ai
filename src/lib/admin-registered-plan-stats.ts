import { isPaidTier, tierFrom, type PlanTier } from '@/lib/plan-utils'

interface RegisteredPlanGroup {
  plan: string
  _count: { _all: number }
}

/** 同じ集計結果から全登録数と有料プラン登録数を算出する。実入金人数ではない。 */
export function summarizeRegisteredPlans(groups: RegisteredPlanGroup[]) {
  if (!Array.isArray(groups)) throw new Error('Invalid registered plan groups')
  let totalUsers = 0
  let paidPlanUsers = 0
  const registeredPlanTiers: Record<PlanTier, number> = { GUEST: 0, FREE: 0, LIGHT: 0, PRO: 0, ENTERPRISE: 0 }
  for (const group of groups) {
    const count = group?._count?._all
    if (typeof group?.plan !== 'string' || !Number.isSafeInteger(count) || count < 0) throw new Error('Invalid registered plan count')
    totalUsers += count
    if (!Number.isSafeInteger(totalUsers)) throw new Error('Registered plan total exceeds safe range')
    const tier = tierFrom(group.plan)
    registeredPlanTiers[tier] += count
    if (isPaidTier(tier)) paidPlanUsers += count
  }
  return { totalUsers, paidPlanUsers, otherPlanUsers: totalUsers - paidPlanUsers, registeredPlanTiers }
}
