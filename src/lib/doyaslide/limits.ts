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
  FREE: { tier: 'FREE', maxProjects: 3, maxSlidesPerMonth: 30 },
  LIGHT: { tier: 'LIGHT', maxProjects: -1, maxSlidesPerMonth: 1000 },
  PRO: { tier: 'PRO', maxProjects: -1, maxSlidesPerMonth: 1000 },
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
