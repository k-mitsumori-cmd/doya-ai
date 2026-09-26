import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getBannerMonthlyLimitByUserPlan, getBannerMaxImagesPerRequest, shouldResetMonthlyUsage } from '@/lib/pricing'

type BannerQuotaDb = Pick<PrismaClient, 'user' | 'userServiceSubscription'>

export type BannerQuotaUsage = {
  monthlyLimit: number
  monthlyUsed: number
  monthlyRemaining: number
}

export type BannerReservation = {
  id: string
  lastUsageReset: Date
  requested: number
  count: number
  plan: string
  usage: BannerQuotaUsage
}

export type BannerQuotaClaim =
  | { state: 'reserved'; reservation: BannerReservation }
  | { state: 'limit'; usage: BannerQuotaUsage; plan: string }

const SERVICE_ID = 'banner'
const MAX_RETRIES = 20

function usage(limit: number, used: number): BannerQuotaUsage {
  return {
    monthlyLimit: limit,
    monthlyUsed: used,
    monthlyRemaining: limit < 0 ? -1 : Math.max(0, limit - used),
  }
}

/** Reserve before calling the paid image API. Compare-and-swap serializes all three banner routes. */
export async function reserveBannerMonthlyImages(
  userId: string,
  requestedCount: number,
  db: BannerQuotaDb = prisma,
): Promise<BannerQuotaClaim> {
  if (!userId || !Number.isSafeInteger(requestedCount) || requestedCount < 1) throw new Error('Invalid banner quota request')
  const existing = await db.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: SERVICE_ID } },
    select: { id: true },
  })
  if (!existing) {
    const account = await db.user.findUnique({ where: { id: userId }, select: { plan: true } })
    if (!account) throw new Error('Banner quota account unavailable')
    await db.userServiceSubscription.upsert({
      where: { userId_serviceId: { userId, serviceId: SERVICE_ID } },
      create: { userId, serviceId: SERVICE_ID, plan: account.plan || 'FREE', dailyUsage: 0, monthlyUsage: 0, lastUsageReset: new Date() },
      update: {},
    })
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const current = await db.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: SERVICE_ID } },
      select: { id: true, plan: true, monthlyUsage: true, lastUsageReset: true },
    })
    if (!current) throw new Error('Banner quota subscription unavailable')
    if (shouldResetMonthlyUsage(current.lastUsageReset) || current.monthlyUsage < 0) {
      const reset = await db.userServiceSubscription.updateMany({
        where: { id: current.id, monthlyUsage: current.monthlyUsage, lastUsageReset: current.lastUsageReset },
        data: { monthlyUsage: 0, lastUsageReset: new Date() },
      })
      if (!reset.count) continue
      continue
    }

    const plan = String(current.plan || 'FREE').toUpperCase()
    const count = Math.min(requestedCount, getBannerMaxImagesPerRequest(plan))
    const limit = getBannerMonthlyLimitByUserPlan(plan)
    if (limit >= 0 && current.monthlyUsage + count > limit) {
      return { state: 'limit', plan, usage: usage(limit, current.monthlyUsage) }
    }
    const claimed = await db.userServiceSubscription.updateMany({
      where: {
        id: current.id,
        plan: current.plan,
        monthlyUsage: current.monthlyUsage,
        lastUsageReset: current.lastUsageReset,
      },
      data: { monthlyUsage: { increment: count } },
    })
    if (claimed.count) {
      return {
        state: 'reserved',
        reservation: {
          id: current.id,
          lastUsageReset: current.lastUsageReset,
          requested: requestedCount,
          count,
          plan,
          usage: usage(limit, current.monthlyUsage + count),
        },
      }
    }
  }
  throw new Error('Banner quota contention')
}

/** Return unused reserved images. A reset in another month/admin action must not be undone. */
export async function releaseBannerMonthlyImages(
  reservation: BannerReservation,
  unused: number,
  db: BannerQuotaDb = prisma,
): Promise<BannerQuotaUsage> {
  if (!Number.isSafeInteger(unused) || unused < 0 || unused > reservation.count) throw new Error('Invalid banner quota release')
  if (!unused) return reservation.usage
  const released = await db.userServiceSubscription.updateMany({
    where: {
      id: reservation.id,
      lastUsageReset: reservation.lastUsageReset,
      monthlyUsage: { gte: unused },
    },
    data: { monthlyUsage: { decrement: unused } },
  })
  return released.count ? usage(reservation.usage.monthlyLimit, reservation.usage.monthlyUsed - unused) : reservation.usage
}
