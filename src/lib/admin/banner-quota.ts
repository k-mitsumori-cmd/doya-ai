import { getBannerMonthlyLimitByUserPlan, shouldResetMonthlyUsage } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'

type BannerSubscription = {
  plan: string | null
  monthlyUsage: number
  lastUsageReset: Date | null
} | null

/** Match the banner generation API: use the higher account or service grant and the current JST month. */
export function summarizeBannerMonthlyQuota(subscription: BannerSubscription, accountPlan: string | null = 'FREE') {
  const limit = getBannerMonthlyLimitByUserPlan(higherPlan(subscription?.plan, accountPlan))
  const used = subscription && !shouldResetMonthlyUsage(subscription.lastUsageReset)
    ? Math.max(0, subscription.monthlyUsage)
    : 0
  return { used, limit, remaining: limit < 0 ? null : Math.max(0, limit - used) }
}
