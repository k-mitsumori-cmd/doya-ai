import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, isWithinFreeHour } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'

const PAID_PLANS = new Set(['LIGHT', 'PRO', 'ENTERPRISE', 'BUNDLE', 'BASIC', 'STARTER', 'BUSINESS'])

/** The same database-backed retention boundary for list, thumbnail and original image. */
export async function bannerHistoryCutoff(userId: string, firstLoginAt: Date | string | null | undefined, now = new Date()): Promise<Date | null> {
  const [sub, account] = await Promise.all([
    prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'banner' } }, select: { plan: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ])
  if (!account) throw new Error('Banner history account unavailable')
  const plan = higherPlan(sub?.plan, account.plan)
  const paid = PAID_PLANS.has(plan) || isWithinFreeHour(firstLoginAt)
  const days = paid ? BANNER_PRICING.historyDays.pro : BANNER_PRICING.historyDays.free
  if (days === 0) return null
  if (days < 0) return new Date(0)
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  return cutoff
}
