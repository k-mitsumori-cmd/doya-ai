// ============================================
// ドヤスライド プラン上限
// ============================================
// 統一プラン方式（無料 / プロ¥9,980）。判定は User.plan を tierFrom で正規化。
import { prisma } from '@/lib/prisma'
import { tierFrom, type PlanTier } from '@/lib/plan-utils'

export interface DoyaSlideLimits {
  tier: PlanTier
  maxProjects: number // -1 = unlimited
  maxSlidesPerMonth: number // 生成スライド枚数/月（-1 = unlimited）
}

export const DOYASLIDE_LIMITS: Record<PlanTier, DoyaSlideLimits> = {
  GUEST: { tier: 'GUEST', maxProjects: 0, maxSlidesPerMonth: 0 },
  FREE: { tier: 'FREE', maxProjects: 3, maxSlidesPerMonth: 20 },
  LIGHT: { tier: 'LIGHT', maxProjects: -1, maxSlidesPerMonth: 150 },
  PRO: { tier: 'PRO', maxProjects: -1, maxSlidesPerMonth: 150 },
  ENTERPRISE: { tier: 'ENTERPRISE', maxProjects: -1, maxSlidesPerMonth: -1 },
}

export async function getUserTier(userId: string): Promise<PlanTier> {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return 'ENTERPRISE'
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  return tierFrom(user?.plan)
}

export async function getUserDoyaSlideLimits(userId: string): Promise<DoyaSlideLimits> {
  const tier = await getUserTier(userId)
  return DOYASLIDE_LIMITS[tier]
}

const DOYASLIDE_SERVICE_ID = 'doyaslide'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
export const DOYASLIDE_PROJECT_SERVICE_ID = 'doyaslide-projects'

export function monthStart(now = new Date()): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_OFFSET_MS)
}

export function isSameMonth(a: Date, b: Date): boolean {
  return monthStart(a).getTime() === monthStart(b).getTime()
}

/** 上限超過時のユーザー向け共通メッセージ（全ルートで使い回す） */
export function quotaExceededMessage(limit: number): string {
  return `今月の生成枚数の上限（${limit}枚）に達しました。生成・再生成・チャット修正はそれぞれ1枚分を消費します。プロにアップグレードしてください。`
}

/** 当月の使用枚数（月が変わっていれば0）。判定・表示の単一ソース（UserServiceSubscription.monthlyUsage）。 */
export async function getMonthlyUsage(userId: string): Promise<number> {
  const sub = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
    select: { monthlyUsage: true, lastUsageReset: true },
  })
  if (!sub) return 0
  return isSameMonth(sub.lastUsageReset, new Date()) ? Math.max(0, sub.monthlyUsage) : 0
}

/**
 * 当月の生成枚数を「残枠まで」原子的に予約する。
 * 利用者行のロック下で月次リセット・残枠判定・予約を1トランザクションに収める。
 * 返り値 granted = 実際に確保できた枚数（min(add, 残枠)）。granted < add のときは一部のみ生成可。
 * 生成に失敗した分は releaseMonthlySlides で戻すこと。
 */
export async function reserveMonthlySlides(
  userId: string,
  add: number
): Promise<{ granted: number; limit: number; reservedMonth: Date | null }> {
  if (!Number.isSafeInteger(add) || add < 1) throw new Error('Invalid slide reservation count')
  const tier = await getUserTier(userId)
  const limit = DOYASLIDE_LIMITS[tier].maxSlidesPerMonth
  if (limit === -1) return { granted: add, limit: -1, reservedMonth: null }

  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (users.length === 0) throw new Error('DoyaSlide account not found')
    const now = new Date()
    const where = { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } }
    const existing = await tx.userServiceSubscription.findUnique({
      where, select: { monthlyUsage: true, lastUsageReset: true },
    })
    const current = existing && isSameMonth(existing.lastUsageReset, now)
      ? Math.max(0, existing.monthlyUsage) : 0
    const granted = Math.min(add, Math.max(0, limit - current))
    if (!existing) {
      await tx.userServiceSubscription.create({
        data: { userId, serviceId: DOYASLIDE_SERVICE_ID, monthlyUsage: granted, lastUsageReset: now },
      })
    } else if (!isSameMonth(existing.lastUsageReset, now) || existing.monthlyUsage !== current || granted > 0) {
      await tx.userServiceSubscription.update({
        where, data: { monthlyUsage: current + granted, lastUsageReset: now },
      })
    }
    return { granted, limit, reservedMonth: monthStart(now) }
  })
}

/** 予約したが生成に失敗した枚数を戻す */
export async function releaseMonthlySlides(userId: string, n: number, reservedMonth: Date | null): Promise<void> {
  if (n <= 0 || !reservedMonth) return // 無制限プランでは予約・返却をしない
  await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (users.length === 0) return
    const where = { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } }
    const existing = await tx.userServiceSubscription.findUnique({
      where, select: { monthlyUsage: true, lastUsageReset: true },
    })
    if (!existing || !isSameMonth(existing.lastUsageReset, reservedMonth)) return
    const decrement = Math.min(Math.max(0, existing.monthlyUsage), n)
    if (decrement > 0) {
      await tx.userServiceSubscription.update({ where, data: { monthlyUsage: { decrement } } })
    }
  }).catch((error) => { console.error('[doyaslide/quota] refund failed', error) })
}

/** 当月の画像生成回数をカウント（生成・再生成・チャット修正のたびに1版作られる＝生成枚数） */
export async function countMonthlySlides(userId: string): Promise<number> {
  return prisma.doyaSlideVersion.count({
    where: {
      slide: { project: { userId } },
      createdAt: { gte: monthStart() },
    },
  })
}

export async function countProjects(userId: string): Promise<number> {
  const now = new Date()
  const [existing, ledger] = await Promise.all([
    prisma.doyaSlideProject.count({ where: { userId, createdAt: { gte: monthStart(now) } } }),
    prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID } },
      select: { monthlyUsage: true, lastUsageReset: true },
    }),
  ])
  return Math.max(existing, ledger && isSameMonth(ledger.lastUsageReset, now) ? ledger.monthlyUsage : 0)
}
