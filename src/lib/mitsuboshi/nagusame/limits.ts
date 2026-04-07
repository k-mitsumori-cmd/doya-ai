/**
 * ナグサメ フリーミアム制限
 *
 * - 匿名ユーザー: guestId cookie で 1日3回
 * - Free プラン: 1日3回 + 5キャラ
 * - PRO プラン: 無制限 + 全キャラ
 */

import { prisma } from '@/lib/prisma'
import { MITSUBOSHI_DISABLE_LIMITS } from '../_shared/constants'

const FREE_DAILY_LIMIT = 3

export interface LimitCheckResult {
  allowed: boolean
  plan: 'free' | 'pro'
  usedToday: number
  dailyLimit: number
  reason?: string
}

/**
 * 今日の投稿回数をカウントし、残量があるかを返す。
 */
export async function checkNagusameLimit(params: {
  userId?: string | null
  guestId?: string | null
}): Promise<LimitCheckResult> {
  const { userId, guestId } = params

  if (MITSUBOSHI_DISABLE_LIMITS) {
    return { allowed: true, plan: 'pro', usedToday: 0, dailyLimit: -1 }
  }

  // PRO プラン判定
  let plan: 'free' | 'pro' = 'free'
  if (userId) {
    const sub = await prisma.mitsuboshiNagusameSubscription.findUnique({
      where: { userId },
    })
    if (
      sub?.plan === 'pro' &&
      (!sub.currentPeriodEnd || sub.currentPeriodEnd > new Date())
    ) {
      plan = 'pro'
    }
  }

  if (plan === 'pro') {
    return { allowed: true, plan, usedToday: 0, dailyLimit: -1 }
  }

  // 今日の0時
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const where = userId
    ? { userId, createdAt: { gte: startOfDay } }
    : { guestId: guestId || '__no_guest__', createdAt: { gte: startOfDay } }

  const usedToday = await prisma.mitsuboshiNagusamePost.count({ where })

  if (usedToday >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      plan,
      usedToday,
      dailyLimit: FREE_DAILY_LIMIT,
      reason: `本日の無料枠（${FREE_DAILY_LIMIT}回）を使い切りました。PROにすると無制限でお話しできます。`,
    }
  }

  return {
    allowed: true,
    plan,
    usedToday,
    dailyLimit: FREE_DAILY_LIMIT,
  }
}
