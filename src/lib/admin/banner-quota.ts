import { getBannerMonthlyLimitByUserPlan, shouldResetMonthlyUsage } from '@/lib/pricing'

type BannerSubscription = {
  plan: string | null
  monthlyUsage: number
  lastUsageReset: Date | null
} | null

/** Match the banner generation API: the subscription plan and the current JST month. */
export function summarizeBannerMonthlyQuota(subscription: BannerSubscription, accountPlan: string | null = 'FREE') {
  // First generation creates a subscription from the account's current plan.
  const limit = getBannerMonthlyLimitByUserPlan(subscription?.plan ?? accountPlan)
  const used = subscription && !shouldResetMonthlyUsage(subscription.lastUsageReset)
    ? Math.max(0, subscription.monthlyUsage)
    : 0
  return { used, limit, remaining: limit < 0 ? null : Math.max(0, limit - used) }
}
