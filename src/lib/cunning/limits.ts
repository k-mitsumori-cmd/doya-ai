// ============================================
// ドヤカンニング プラン上限
// ============================================
// 統一プラン方式（無料 / プロ¥9,980）。判定は User.plan を tierFrom で正規化。
// サーバー時間台帳を参照し、旧録音の累積時間も引き継ぐ。
import { prisma } from '@/lib/prisma'
import { tierFrom, type PlanTier } from '@/lib/plan-utils'

import { CUNNING_LIMITS, type CunningLimits } from './limit-config'
import { readCunningRecordingUsage } from './recording-ledger'
export { CUNNING_LIMITS, type CunningLimits } from './limit-config'

export async function getUserTier(userId: string): Promise<PlanTier> {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return 'ENTERPRISE'
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  return tierFrom(user?.plan)
}

export async function getCunningLimits(userId: string): Promise<CunningLimits> {
  const tier = await getUserTier(userId)
  return CUNNING_LIMITS[tier]
}

/** Authoritative elapsed usage. Outstanding reservations are reported separately. */
export async function getMonthlyUsedSeconds(userId: string): Promise<number> {
  const usage = await readCunningRecordingUsage(prisma, userId)
  if (!usage) throw new Error('Cunning account not found')
  return usage.usedSeconds
}

export interface CunningUsage {
  tier: PlanTier
  limits: CunningLimits
  usedSeconds: number
  reservedSeconds: number
  resetAt: Date
  remainingSeconds: number // -1 = unlimited
  usedMinutes: number
  remainingMinutes: number // -1 = unlimited
  knowledgeBases: number
}

export async function getCunningUsage(userId: string): Promise<CunningUsage> {
  const usage = await readCunningRecordingUsage(prisma, userId)
  if (!usage) throw new Error('Cunning account not found')
  const kbCount = await prisma.cunningKnowledgeBase.count({ where: { userId } })
  return {
    tier: usage.tier, limits: usage.limits,
    usedSeconds: usage.usedSeconds, reservedSeconds: usage.reservedSeconds,
    resetAt: usage.resetAt,
    remainingSeconds: usage.remainingSeconds,
    usedMinutes: Math.floor(usage.usedSeconds / 60),
    remainingMinutes: usage.remainingSeconds === -1 ? -1 : Math.ceil(usage.remainingSeconds / 60),
    knowledgeBases: kbCount,
  }
}

/** セッション開始可否（当月の利用時間が上限内か）。上限到達なら理由を返す。 */
export async function canStartSession(userId: string): Promise<{ ok: boolean; reason?: string; code?: 'LIMIT' | 'RECORDING_RESERVED'; upgradeAvailable?: boolean }> {
  const usage = await readCunningRecordingUsage(prisma, userId)
  if (!usage) return { ok: false, reason: 'ログインが必要です' }
  const { limits } = usage
  if (limits.tier === 'GUEST') return { ok: false, reason: 'ログインが必要です' }
  if (limits.maxMinutesPerMonth === -1) return { ok: true }
  if (usage.remainingSeconds <= 0) {
    if (usage.reservedSeconds > 0) return { ok: false, code: 'RECORDING_RESERVED', reason: '別の録音で利用時間を確保しています。録音の停止後に利用状況を再確認してください。' }
    return {
      ok: false,
      code: 'LIMIT',
      upgradeAvailable: limits.tier === 'FREE',
      reason: limits.tier === 'FREE'
        ? `今月の利用時間の上限（${limits.maxMinutesPerMonth}分）に達しました。プロプランで上限を増やせます。`
        : `今月の利用時間の上限（${limits.maxMinutesPerMonth}分）に達しました。来月1日に枠が戻ります。追加をご希望の場合はお問い合わせください。`,
    }
  }
  return { ok: true }
}
