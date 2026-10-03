import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shouldResetMonthlyUsage, getBannerMonthlyLimitByUserPlan } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

/**
 * プランページ用の統計API
 * - 累計生成枚数（全期間）
 * - 今日の使用回数
 * ※ 履歴閲覧とは異なり、有料/無料に関わらず自分の統計は取得可能
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    
    if (!userId) {
      // ゲストはDBに履歴がないので0を返す
      return NextResponse.json({
        totalBanners: 0,
        todayUsage: 0,
        monthlyUsage: 0,
      }, { headers: privateHeaders })
    }

    // 累計生成枚数（全期間）
    const totalCount = await prisma.generation.count({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
      },
    })

    // 使用状況（UserServiceSubscriptionから取得）
    const [sub, account] = await Promise.all([
      prisma.userServiceSubscription.findUnique({
        where: { userId_serviceId: { userId, serviceId: 'banner' } },
        select: { plan: true, monthlyUsage: true, lastUsageReset: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    ])
    if (!account) return NextResponse.json({ error: '利用プランを確認できませんでした' }, { status: 503, headers: privateHeaders })

    // 月が変わっていたら0（日本時間基準）
    const monthlyUsage = shouldResetMonthlyUsage(sub?.lastUsageReset) ? 0 : (sub?.monthlyUsage || 0)
    const monthlyLimit = getBannerMonthlyLimitByUserPlan(higherPlan(sub?.plan, account.plan))

    return NextResponse.json({
      totalBanners: totalCount,
      monthlyUsage,
      monthlyLimit,
    }, { headers: privateHeaders })
  } catch (e: any) {
    console.error('[banner stats] failed')
    return NextResponse.json({ error: '統計の取得に失敗しました' }, { status: 500, headers: privateHeaders })
  }
}
