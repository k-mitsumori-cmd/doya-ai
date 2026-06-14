// ============================================
// ドヤ広告バナーAI 認証・ゲスト・プラン上限
// ログインユーザーは User.plan（統一プラン）、未ログインは guestId(Cookie) で利用回数管理。
// ============================================
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { AdPlanTier } from './types'

export const GUEST_COOKIE = 'adbanner_gid'

// 日次上限（生成枚数）
export const DAILY_LIMIT: Record<AdPlanTier, number> = { GUEST: 3, FREE: 9, PRO: 60 }

export interface AdIdentity {
  userId: string | null
  guestId: string | null
  plan: AdPlanTier
}

function isPaid(plan?: string | null) {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}

/** リクエストから利用者の識別とプランを解決 */
export async function getAdIdentity(req: NextRequest): Promise<AdIdentity> {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = u?.id
  }
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
    return { userId, guestId: null, plan: isPaid(u?.plan) ? 'PRO' : 'FREE' }
  }
  const guestId = req.cookies.get(GUEST_COOKIE)?.value || null
  return { userId: null, guestId, plan: 'GUEST' }
}

/** キャンペーン所有者スコープ（IDOR防止に使う where 条件） */
export function ownerWhere(id: AdIdentity): { userId: string } | { guestId: string } | null {
  if (id.userId) return { userId: id.userId }
  if (id.guestId) return { guestId: id.guestId }
  return null
}

/** JST 当日0時の UTC Date */
export function jstStartOfTodayUtc(): Date {
  const now = Date.now()
  const jst = new Date(now + 9 * 3600_000)
  const y = jst.getUTCFullYear(), m = jst.getUTCMonth(), d = jst.getUTCDate()
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - 9 * 3600_000)
}

/** 当日の生成枚数（JST） */
export async function usageToday(id: AdIdentity): Promise<number> {
  const where = ownerWhere(id)
  if (!where) return 0
  return prisma.adBannerCreative.count({
    where: { campaign: where as any, createdAt: { gte: jstStartOfTodayUtc() } },
  })
}

/** 残り生成可能枚数 */
export async function remainingQuota(id: AdIdentity): Promise<{ limit: number; used: number; remaining: number }> {
  const limit = DAILY_LIMIT[id.plan]
  const used = await usageToday(id)
  return { limit, used, remaining: Math.max(0, limit - used) }
}
