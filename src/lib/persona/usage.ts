import type { PrismaClient } from '@prisma/client'
import { getPersonaDailyLimitByUserPlan } from '@/lib/pricing'
import { isPaidPlan } from '@/lib/unified-plan'
import { personaUsageDay } from './usage-day'
import { personaExtraImageLimit } from './image-ledger'

export async function getPersonaUsage(db: PrismaClient, userId: string, now = new Date()) {
  const day = personaUsageDay(now)
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } })
    if (!user) return null
    const text = await tx.personaUsageDay.findUnique({ where: { userId_day: { userId, day } } })
    const image = await tx.personaImageUsageDay.findUnique({ where: { userId_day: { userId, day } } })
    const legacy = !text ? await tx.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'persona' } } }) : null
    const oldUsed = legacy?.lastUsageReset && personaUsageDay(legacy.lastUsageReset).getTime() === day.getTime() ? Math.max(0, legacy.dailyUsage) : 0
    const textPending = await tx.personaProject.count({ where: { userId, usageDay: day, status: 'pending', deletedAt: null, leaseExpiresAt: { gt: now } } })
    const imagePending = await tx.personaImageJob.count({ where: { project: { userId, deletedAt: null }, usageDay: day, status: 'pending', intent: { not: 'included' }, leaseExpiresAt: { gt: now } } })
    const quota = (used: number, reserved: number, limit: number) => ({ used, reserved, limit, remaining: limit < 0 ? null : Math.max(0, limit - used - reserved) })
    return {
      planLabel: isPaidPlan(user.plan) ? 'PRO' : 'FREE',
      text: quota(text?.used ?? oldUsed, textPending, getPersonaDailyLimitByUserPlan(user.plan)),
      extraImages: quota(image?.used ?? 0, imagePending, personaExtraImageLimit(user.plan)),
      resetAt: new Date(day.getTime() + 86400000).toISOString(),
    }
  }, { isolationLevel: 'RepeatableRead' })
}
