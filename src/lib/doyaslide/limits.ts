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

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
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
  return isSameMonth(sub.lastUsageReset, new Date()) ? sub.monthlyUsage : 0
}

/**
 * 当月の生成枚数を「残枠まで」原子的に予約する。
 * monthlyUsage を原子的 increment し結果値で判定するため、並行リクエストでも上限を超えない（TOCTOU回避）。
 * 返り値 granted = 実際に確保できた枚数（min(add, 残枠)）。granted < add のときは一部のみ生成可。
 * 生成に失敗した分は releaseMonthlySlides で戻すこと。
 */
export async function reserveMonthlySlides(
  userId: string,
  add: number
): Promise<{ granted: number; limit: number }> {
  const tier = await getUserTier(userId)
  const limit = DOYASLIDE_LIMITS[tier].maxSlidesPerMonth
  if (limit === -1) return { granted: add, limit: -1 }

  const now = new Date()
  const existing = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
    select: { lastUsageReset: true },
  })
  if (!existing) {
    await prisma.userServiceSubscription.upsert({
      where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
      create: { userId, serviceId: DOYASLIDE_SERVICE_ID, monthlyUsage: 0, lastUsageReset: now },
      update: {},
    })
  } else if (!isSameMonth(existing.lastUsageReset, now)) {
    // 月跨ぎはリセット
    await prisma.userServiceSubscription.update({
      where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
      data: { monthlyUsage: 0, lastUsageReset: now },
    })
  }

  // 原子的インクリメント → 結果値で判定（並行でも各リクエストが一意の値を得る）
  const updated = await prisma.userServiceSubscription.update({
    where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
    data: { monthlyUsage: { increment: add } },
    select: { monthlyUsage: true },
  })

  if (updated.monthlyUsage <= limit) {
    return { granted: add, limit }
  }
  // 超過分は戻し、残枠ぶんだけ確保
  const overflow = updated.monthlyUsage - limit
  const granted = Math.max(0, add - overflow)
  await prisma.userServiceSubscription.update({
    where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
    data: { monthlyUsage: { decrement: add - granted } },
  })
  return { granted, limit }
}

/** 予約したが生成に失敗した枚数を戻す */
export async function releaseMonthlySlides(userId: string, n: number): Promise<void> {
  if (n <= 0) return
  await prisma.userServiceSubscription
    .update({
      where: { userId_serviceId: { userId, serviceId: DOYASLIDE_SERVICE_ID } },
      data: { monthlyUsage: { decrement: n } },
    })
    .catch(() => {})
}

function monthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
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
  return prisma.doyaSlideProject.count({ where: { userId } })
}
