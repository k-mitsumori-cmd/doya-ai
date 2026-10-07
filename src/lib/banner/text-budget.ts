import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { higherPlan } from '@/lib/plan-utils'
import { HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'

type BannerTextDb = Pick<PrismaClient, '$transaction' | 'user' | 'userServiceSubscription'>

export type BannerTextUsage = {
  dailyLimit: number
  dailyUsed: number
  dailyRemaining: number
}

export type BannerTextAdmission =
  | { state: 'allowed'; usage: BannerTextUsage }
  | { state: 'limit'; usage: BannerTextUsage; upgradeAvailable: boolean }

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

async function textBudgetPolicy(userId: string, db: Pick<PrismaClient, 'user' | 'userServiceSubscription'>) {
  if (!userId.trim()) throw new Error('Banner text identity is required')
  const [subscription, account] = await Promise.all([
    db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId, serviceId: 'banner' } }, select: { plan: true } }),
    db.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ])
  if (!account) throw new Error('Banner text account unavailable')
  const plan = higherPlan(subscription?.plan, account.plan)
  return { plan, limit: bannerTextDailyLimit(plan) }
}

async function reserveTextBudget(userId: string, plan: string, limit: number, tx: Prisma.TransactionClient): Promise<BannerTextAdmission> {
  if (limit < 0) return { state: 'allowed', usage: dailyUsage(limit, 0) }
  const key = `banner-text:v1:${createHash('sha256').update(userId).digest('hex')}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  const saved = row?.value || ''
  if (saved && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(saved)) throw new Error('Banner text usage ledger invalid')
  const used = saved.startsWith(`${day}:`) ? Number(saved.slice(day.length + 1)) : 0
  if (!Number.isSafeInteger(used)) throw new Error('Banner text usage ledger invalid')
  if (used >= limit) return { state: 'limit', usage: dailyUsage(limit, used), upgradeAvailable: plan === 'GUEST' || plan === 'FREE' || plan === 'LIGHT' }
  await tx.systemSetting.upsert({ where: { key }, create: { key, value: `${day}:${used + 1}` }, update: { value: `${day}:${used + 1}` } })
  return { state: 'allowed', usage: dailyUsage(limit, used + 1) }
}

/** The chat and copy APIs share one atomic JST daily operation budget. */
export async function reserveBannerTextCall(userId: string, db: BannerTextDb = prisma): Promise<BannerTextAdmission> {
  const { plan, limit } = await textBudgetPolicy(userId, db)
  return db.$transaction(tx => reserveTextBudget(userId, plan, limit, tx), { timeout: 15000 })
}

/** Used inside the caller's short operation-admission transaction; no nested transaction. */
export async function reserveBannerTextCallInTransaction(userId: string, tx: Prisma.TransactionClient): Promise<BannerTextAdmission> {
  const { plan, limit } = await textBudgetPolicy(userId, tx)
  return reserveTextBudget(userId, plan, limit, tx)
}

export function bannerTextLimitPayload(usage: BannerTextUsage, upgradeAvailable: boolean) {
  return {
    error: `本日のAI相談・コピー提案の上限（${usage.dailyLimit}回）に達しました。`,
    code: 'DAILY_TEXT_LIMIT_REACHED',
    usage,
    ...(upgradeAvailable ? { upgradeUrl: '/banner/pricing' } : { contactUrl: HIGH_USAGE_CONTACT_URL }),
  }
}
