// ============================================
// ドヤ展開AI — 認証・認可・利用制限ヘルパー
// ============================================

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// プランコード
export type TenkaiPlanCode = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'

// プラン別制限
export const PLAN_LIMITS: Record<
  TenkaiPlanCode,
  {
    monthlyCredits: number // -1 = 無制限
    platforms: number
    inputChars: number
  }
> = {
  FREE: { monthlyCredits: 10, platforms: 3, inputChars: 5000 },
  STARTER: { monthlyCredits: 50, platforms: 5, inputChars: 20000 },
  PRO: { monthlyCredits: 200, platforms: 9, inputChars: 50000 },
  ENTERPRISE: { monthlyCredits: -1, platforms: 9, inputChars: 100000 },
}

/**
 * セッションからユーザー情報を取得
 */
export async function getTenkaiUser(): Promise<{
  userId: string | null
  plan: TenkaiPlanCode
}> {
  const session = await getServerSession(authOptions)
  const user = session?.user || null
  const userId = String(user?.id || '').trim() || null

  let plan: TenkaiPlanCode = 'FREE'
  // サービス別サブスクリプションからtenkaiプランを取得
  if (userId) {
    const sub = await prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'tenkai' } },
      select: { plan: true },
    })
    if (sub?.plan) {
      plan = normalizePlan(sub.plan)
    }
  }

  return { userId, plan }
}

/**
 * プランコードの正規化
 */
export function normalizePlan(raw: string | undefined | null): TenkaiPlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'STARTER') return 'STARTER'
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  return 'FREE'
}

/**
 * 月間利用制限チェック
 * 制限内 → null / 超過 → エラーレスポンス
 */
export async function checkTenkaiUsage(
  userId: string,
  plan: TenkaiPlanCode
): Promise<NextResponse | null> {
  const limits = PLAN_LIMITS[plan]
  if (limits.monthlyCredits < 0) return null // 無制限

  const yearMonth = getCurrentYearMonth()
  const usage = await prisma.tenkaiUsage.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
  })

  const used = usage?.creditsUsed || 0
  if (used >= limits.monthlyCredits) {
    return NextResponse.json(
      {
        error: `月間利用上限 (${limits.monthlyCredits}回) に達しました。プランをアップグレードしてください。`,
        code: 'USAGE_LIMIT_EXCEEDED',
        used,
        limit: limits.monthlyCredits,
      },
      { status: 429 }
    )
  }
  return null
}

/**
 * 利用回数カウントアップ
 */
export async function incrementTenkaiUsage(
  userId: string,
  tokensUsed: number = 0
): Promise<void> {
  const yearMonth = getCurrentYearMonth()
  await prisma.tenkaiUsage.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    create: {
      userId,
      yearMonth,
      creditsUsed: 1,
      tokensTotal: tokensUsed,
      projectsCreated: 0,
    },
    update: {
      creditsUsed: { increment: 1 },
      tokensTotal: { increment: tokensUsed },
    },
  })
}

/**
 * プロジェクト作成カウントアップ
 */
export async function incrementProjectCount(userId: string): Promise<void> {
  const yearMonth = getCurrentYearMonth()
  await prisma.tenkaiUsage.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    create: {
      userId,
      yearMonth,
      creditsUsed: 0,
      tokensTotal: 0,
      projectsCreated: 1,
    },
    update: {
      projectsCreated: { increment: 1 },
    },
  })
}

/**
 * ユーザーのtenkaiプラン取得
 */
export async function getTenkaiPlan(userId: string): Promise<TenkaiPlanCode> {
  const sub = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: 'tenkai' } },
    select: { plan: true },
  })
  return sub?.plan ? normalizePlan(sub.plan) : 'FREE'
}

/**
 * 現在の年月 (YYYY-MM形式)
 */
function getCurrentYearMonth(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
