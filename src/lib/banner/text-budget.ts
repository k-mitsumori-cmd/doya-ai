import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type BannerTextDb = Pick<PrismaClient, '$transaction' | 'user' | 'userServiceSubscription'>

export type BannerTextUsage = {
  dailyLimit: number
  dailyUsed: number
  dailyRemaining: number
}

export type BannerTextAdmission =
  | { state: 'allowed'; usage: BannerTextUsage }
  | { state: 'limit'; usage: BannerTextUsage }

export function bannerTextDailyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.BANNER_DISABLE_LIMITS === '1') return -1
  const tier = String(plan || 'FREE').toUpperCase()
  if (tier === 'ENTERPRISE') return 1000
  if (['PRO', 'BUNDLE', 'BASIC', 'STARTER', 'BUSINESS'].includes(tier)) return 100
  if (tier === 'LIGHT') return 30
  return 10
}

function dailyUsage(limit: number, used: number): BannerTextUsage {
  return { dailyLimit: limit, dailyUsed: used, dailyRemaining: limit < 0 ? -1 : Math.max(0, limit - used) }
}

/** The chat and copy APIs share one atomic JST daily provider-call budget. */
export async function reserveBannerTextCall(userId: string, db: BannerTextDb = prisma): Promise<BannerTextAdmission> {
  if (!userId.trim()) throw new Error('Banner text identity is required')
  const [subscription, account] = await Promise.all([
    db.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'banner' } },
      select: { plan: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ])
  if (!account) throw new Error('Banner text account unavailable')
  const limit = bannerTextDailyLimit(subscription?.plan || account.plan)
  if (limit < 0) return { state: 'allowed', usage: dailyUsage(limit, 0) }

  const key = `banner-text:v1:${createHash('sha256').update(userId).digest('hex')}`
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const saved = row?.value || ''
    if (saved && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(saved)) throw new Error('Banner text usage ledger invalid')
    const used = saved.startsWith(`${day}:`) ? Number(saved.slice(day.length + 1)) : 0
    if (!Number.isSafeInteger(used)) throw new Error('Banner text usage ledger invalid')
    if (used >= limit) return { state: 'limit' as const, usage: dailyUsage(limit, used) }
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: `${day}:${used + 1}` },
      update: { value: `${day}:${used + 1}` },
    })
    return { state: 'allowed' as const, usage: dailyUsage(limit, used + 1) }
  }, { timeout: 15000 })
}

export function bannerTextLimitPayload(usage: BannerTextUsage) {
  return {
    error: `本日のAI相談・コピー提案の上限（${usage.dailyLimit}回）に達しました。`,
    code: 'DAILY_TEXT_LIMIT_REACHED',
    usage,
    upgradeUrl: '/banner/pricing',
  }
}
