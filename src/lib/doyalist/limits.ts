// ============================================
// ドヤリスト プラン上限定義
// ============================================
// 統一プラン方式: ドヤマーケAI課金で全サービスPRO利用可
// ここでは判定用にUserのplanフィールドからtierを推定する

import { prisma } from '@/lib/prisma'
import { tierFrom, type PlanTier } from '@/lib/plan-utils'

export interface DoyalistLimits {
  tier: PlanTier
  maxProjects: number // -1 = unlimited
  maxCompaniesPerMonth: number
  maxApproachesPerMonth: number
}

export const DOYALIST_LIMITS: Record<PlanTier, DoyalistLimits> = {
  GUEST: {
    tier: 'GUEST',
    maxProjects: 0,
    maxCompaniesPerMonth: 0,
    maxApproachesPerMonth: 0,
  },
  FREE: {
    tier: 'FREE',
    maxProjects: -1,
    maxCompaniesPerMonth: 100, // 月100社（おためし）
    maxApproachesPerMonth: 30,
  },
  LIGHT: {
    tier: 'LIGHT',
    maxProjects: -1,
    maxCompaniesPerMonth: 5000, // 月5,000社（PRO相当）
    maxApproachesPerMonth: 500,
  },
  PRO: {
    tier: 'PRO',
    maxProjects: -1,
    maxCompaniesPerMonth: 5000, // 月5,000社
    maxApproachesPerMonth: 500,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    maxProjects: -1,
    maxCompaniesPerMonth: -1,
    maxApproachesPerMonth: -1,
  },
}

/** 日本時間の当月1日0時 */
export function monthStart(now = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000)
}

const APPROACH_QUOTA_SERVICE_ID = 'doyalist-approaches'
const isSameMonth = (a: Date, b: Date) => monthStart(a).getTime() === monthStart(b).getTime()

export function monthlyCompanyWhere(userId: string, now = new Date()) {
  return {
    project: { userId },
    // 重複統合で source は "gbizinfo+corporate_number+..." のように増える。
    OR: [
      { source: 'collected' }, // 旧形式
      { source: { contains: 'gbizinfo' } },
      { source: { contains: 'corporate_number' } },
    ],
    createdAt: { gte: monthStart(now) },
  }
}

/** ユーザーのプラン階層を取得 */
export async function getUserTier(userId: string): Promise<PlanTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  return tierFrom(user?.plan)
}

/** ユーザーの上限情報を取得 */
export async function getUserDoyalistLimits(userId: string): Promise<DoyalistLimits> {
  const tier = await getUserTier(userId)
  return DOYALIST_LIMITS[tier]
}

/** 月内の企業生成数をカウント */
export async function countMonthlyCompanies(userId: string): Promise<number> {
  return prisma.doyalistCompany.count({
    where: monthlyCompanyWhere(userId),
  })
}

/** 月内のアプローチ生成数をカウント */
export async function countMonthlyApproaches(userId: string): Promise<number> {
  const now = new Date()
  const [history, ledger] = await Promise.all([
    prisma.doyalistApproach.count({
      where: { project: { userId }, createdAt: { gte: monthStart(now) } },
    }),
    prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: APPROACH_QUOTA_SERVICE_ID } },
      select: { monthlyUsage: true, lastUsageReset: true },
    }),
  ])
  return Math.max(history, ledger && isSameMonth(ledger.lastUsageReset, now) ? Math.max(0, ledger.monthlyUsage) : 0)
}

/** 月間営業文枠をAI呼び出し前に確保する。複数端末からの同時生成も直列化する。 */
export async function reserveMonthlyApproach(userId: string): Promise<{ granted: boolean; limit: number; reservedMonth: Date | null }> {
  const limits = await getUserDoyalistLimits(userId)
  const limit = limits.maxApproachesPerMonth
  if (limit < 0) return { granted: true, limit, reservedMonth: null }
  if (limit === 0) return { granted: false, limit, reservedMonth: null }
  return prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (users.length === 0) throw new Error('ユーザーが見つかりません')
    const now = new Date()
    const where = { userId_serviceId: { userId, serviceId: APPROACH_QUOTA_SERVICE_ID } }
    const [history, ledger] = await Promise.all([
      tx.doyalistApproach.count({ where: { project: { userId }, createdAt: { gte: monthStart(now) } } }),
      tx.userServiceSubscription.findUnique({ where, select: { monthlyUsage: true, lastUsageReset: true } }),
    ])
    const used = Math.max(history, ledger && isSameMonth(ledger.lastUsageReset, now) ? Math.max(0, ledger.monthlyUsage) : 0)
    if (used >= limit) return { granted: false, limit, reservedMonth: null }
    await tx.userServiceSubscription.upsert({
      where,
      create: { userId, serviceId: APPROACH_QUOTA_SERVICE_ID, monthlyUsage: used + 1, lastUsageReset: now },
      update: { monthlyUsage: used + 1, lastUsageReset: now },
    })
    return { granted: true, limit, reservedMonth: monthStart(now) }
  })
}

/** AI生成そのものが失敗した場合のみ、確保済みの1回を返す。 */
export async function releaseMonthlyApproach(userId: string, reservedMonth: Date | null): Promise<void> {
  if (!reservedMonth) return
  await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (users.length === 0) return
    const where = { userId_serviceId: { userId, serviceId: APPROACH_QUOTA_SERVICE_ID } }
    const ledger = await tx.userServiceSubscription.findUnique({
      where, select: { monthlyUsage: true, lastUsageReset: true },
    })
    if (!ledger || !isSameMonth(ledger.lastUsageReset, reservedMonth) || ledger.monthlyUsage <= 0) return
    await tx.userServiceSubscription.update({ where, data: { monthlyUsage: { decrement: 1 } } })
  }).catch((error) => console.error('[doyalist/approaches] quota refund failed', error))
}

/** 利用可能な残り企業生成数（-1 = unlimited） */
export function remaining(used: number, max: number): number {
  if (max < 0) return -1
  return Math.max(0, max - used)
}
