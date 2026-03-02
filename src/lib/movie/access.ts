// ============================================
// ドヤムービーAI - アクセス制御・使用量管理
// ============================================
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { MOVIE_PRICING } from '@/lib/pricing'

export const MOVIE_GUEST_COOKIE = 'movie_guest_id'

export async function getMovieUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      serviceSubscriptions: {
        where: { serviceId: 'movie' },
      },
    },
  })
  return user
}

export function getGuestIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`${MOVIE_GUEST_COOKIE}=([^;]+)`))
  return match?.[1] ?? null
}

export async function getGuestIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(MOVIE_GUEST_COOKIE)?.value ?? null
}

export function getMovieMonthlyLimit(plan: string | null | undefined): number {
  switch (plan?.toUpperCase()) {
    case 'ENTERPRISE': return MOVIE_PRICING.enterpriseLimit ?? 200
    case 'PRO':        return MOVIE_PRICING.proLimit
    default:           return MOVIE_PRICING.freeLimit
  }
}

export async function checkMovieUsage(userId: string | null, guestId: string | null): Promise<{
  canGenerate: boolean
  used: number
  limit: number
  plan: string
  reason?: string
}> {
  // ゲスト制限
  if (!userId) {
    const guestCount = await prisma.movieProject.count({
      where: {
        guestId: guestId ?? '',
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    })
    return {
      canGenerate: guestCount < MOVIE_PRICING.guestLimit,
      used: guestCount,
      limit: MOVIE_PRICING.guestLimit,
      plan: 'GUEST',
      reason: guestCount >= MOVIE_PRICING.guestLimit ? '月1本の制限に達しました。ログインすると月3本まで無料で利用できます。' : undefined,
    }
  }

  // ユーザープラン取得
  const subscription = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: 'movie' } },
  })
  const plan = subscription?.plan ?? 'FREE'
  const limit = getMovieMonthlyLimit(plan)

  // 今月の使用数
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const used = await prisma.movieProject.count({
    where: {
      userId,
      createdAt: { gte: monthStart },
    },
  })

  return {
    canGenerate: used < limit,
    used,
    limit,
    plan,
    reason: used >= limit ? `今月の生成上限（${limit}本）に達しました。` : undefined,
  }
}
