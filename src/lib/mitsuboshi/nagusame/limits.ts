/**
 * ナグサメ フリーミアム制限
 *
 * - 匿名ユーザー: 署名付き guestId cookie で 1日3回 + 接続元 IP ごとの上限
 * - Free プラン: 1日3回 + 5キャラ
 * - PRO プラン: 投稿は無制限 + 全キャラ（会話の継続は 1 日の上限あり）
 */

import { prisma } from '@/lib/prisma'
import { clientIp, consumeDailyQuota, quotaSubject, type DailyQuotaResult } from '@/lib/server-daily-quota'
import { MITSUBOSHI_DISABLE_LIMITS } from '../_shared/constants'

const FREE_DAILY_LIMIT = 3

// ゲストは Cookie を作り直せるため、接続元 IP ごとの上限を別に数える。
// 同じ回線を複数人で使う場合を考え、1 人分の枠より多めにしている。
const GUEST_IP_DAILY_LIMIT = { generate: 10, chat: 40 } as const
// 会話の継続も有料の AI を呼ぶため、ログイン中でも 1 日の上限を置く（無制限にしない）。
const CHAT_DAILY_LIMIT = { guest: 30, user: 200 } as const

/** ゲストの接続元 IP ごとの 1 日の上限を 1 回分消費する */
export function claimNagusameGuestIp(headers: Headers, kind: 'generate' | 'chat'): Promise<DailyQuotaResult> {
  if (MITSUBOSHI_DISABLE_LIMITS) return Promise.resolve('allowed')
  return consumeDailyQuota(`nagusame-${kind}-ip`, quotaSubject(clientIp(headers)), GUEST_IP_DAILY_LIMIT[kind])
}

/** 会話の継続（chat）の 1 日の上限を、ユーザーまたはゲスト単位で 1 回分消費する */
export function claimNagusameChat(actor: { userId: string } | { guestId: string }): Promise<DailyQuotaResult> {
  if (MITSUBOSHI_DISABLE_LIMITS) return Promise.resolve('allowed')
  return 'userId' in actor
    ? consumeDailyQuota('nagusame-chat-user', quotaSubject(`user:${actor.userId}`), CHAT_DAILY_LIMIT.user)
    : consumeDailyQuota('nagusame-chat-guest', quotaSubject(`guest:${actor.guestId}`), CHAT_DAILY_LIMIT.guest)
}

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
