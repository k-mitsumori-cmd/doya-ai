// ============================================
// ドヤカンニング プラン上限
// ============================================
// 統一プラン方式（無料 / プロ¥9,980）。判定は User.plan を tierFrom で正規化。
// 使用量は「文字起こし時間（分）」で計上。CunningSession.durationSec を当月分合算。
import { prisma } from '@/lib/prisma'
import { tierFrom, type PlanTier } from '@/lib/plan-utils'

export interface CunningLimits {
  tier: PlanTier
  maxMinutesPerMonth: number // -1 = unlimited
  maxKnowledgeBases: number // -1 = unlimited
}

export const CUNNING_LIMITS: Record<PlanTier, CunningLimits> = {
  GUEST: { tier: 'GUEST', maxMinutesPerMonth: 0, maxKnowledgeBases: 0 },
  FREE: { tier: 'FREE', maxMinutesPerMonth: 60, maxKnowledgeBases: 1 },
  LIGHT: { tier: 'LIGHT', maxMinutesPerMonth: 20 * 60, maxKnowledgeBases: -1 },
  PRO: { tier: 'PRO', maxMinutesPerMonth: 20 * 60, maxKnowledgeBases: -1 },
  ENTERPRISE: { tier: 'ENTERPRISE', maxMinutesPerMonth: -1, maxKnowledgeBases: -1 },
}

export async function getUserTier(userId: string): Promise<PlanTier> {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return 'ENTERPRISE'
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  return tierFrom(user?.plan)
}

export async function getCunningLimits(userId: string): Promise<CunningLimits> {
  const tier = await getUserTier(userId)
  return CUNNING_LIMITS[tier]
}

/** 当月に使用した文字起こし時間（秒）。月初からの CunningSession.durationSec 合算。 */
export async function getMonthlyUsedSeconds(userId: string): Promise<number> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const agg = await prisma.cunningSession.aggregate({
    where: { userId, startedAt: { gte: monthStart } },
    _sum: { durationSec: true },
  })
  return agg._sum.durationSec || 0
}

export interface CunningUsage {
  tier: PlanTier
  limits: CunningLimits
  usedMinutes: number
  remainingMinutes: number // -1 = unlimited
  knowledgeBases: number
}

export async function getCunningUsage(userId: string): Promise<CunningUsage> {
  const limits = await getCunningLimits(userId)
  const usedSec = await getMonthlyUsedSeconds(userId)
  const usedMinutes = Math.floor(usedSec / 60)
  const kbCount = await prisma.cunningKnowledgeBase.count({ where: { userId } })
  return {
    tier: limits.tier,
    limits,
    usedMinutes,
    remainingMinutes:
      limits.maxMinutesPerMonth === -1 ? -1 : Math.max(0, limits.maxMinutesPerMonth - usedMinutes),
    knowledgeBases: kbCount,
  }
}

/** セッション開始可否（当月の利用時間が上限内か）。上限到達なら理由を返す。 */
export async function canStartSession(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const limits = await getCunningLimits(userId)
  if (limits.tier === 'GUEST') return { ok: false, reason: 'ログインが必要です' }
  if (limits.maxMinutesPerMonth === -1) return { ok: true }
  const usedSec = await getMonthlyUsedSeconds(userId)
  if (usedSec >= limits.maxMinutesPerMonth * 60) {
    return {
      ok: false,
      reason: `今月の利用時間の上限（${limits.maxMinutesPerMonth}分）に達しました。プロにアップグレードしてください。`,
    }
  }
  return { ok: true }
}
