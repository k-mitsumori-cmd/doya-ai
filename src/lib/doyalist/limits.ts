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
    maxCompaniesPerMonth: 1000, // 月1,000社まで試用可能
    maxApproachesPerMonth: 30,
  },
  LIGHT: {
    tier: 'LIGHT',
    maxProjects: -1,
    maxCompaniesPerMonth: 10000, // 月1万社
    maxApproachesPerMonth: 100,
  },
  PRO: {
    tier: 'PRO',
    maxProjects: -1,
    maxCompaniesPerMonth: 50000, // 月5万社
    maxApproachesPerMonth: 500,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    maxProjects: -1,
    maxCompaniesPerMonth: -1,
    maxApproachesPerMonth: -1,
  },
}

/** 当月開始日（JST基準でなくUTCで月初） */
export function monthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
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
    where: {
      project: { userId },
      source: 'collected',
      createdAt: { gte: monthStart() },
    },
  })
}

/** 月内のアプローチ生成数をカウント */
export async function countMonthlyApproaches(userId: string): Promise<number> {
  return prisma.doyalistApproach.count({
    where: {
      project: { userId },
      createdAt: { gte: monthStart() },
    },
  })
}

/** 利用可能な残り企業生成数（-1 = unlimited） */
export function remaining(used: number, max: number): number {
  if (max < 0) return -1
  return Math.max(0, max - used)
}
