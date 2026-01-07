import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shouldResetDailyUsage } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
      })
    }

    // 累計生成枚数（全期間）
    const totalCount = await prisma.generation.count({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
      },
    })

    // 今日の使用状況（UserServiceSubscriptionから取得）
    const sub = await prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'banner' } },
      select: { dailyUsage: true, monthlyUsage: true, lastUsageReset: true },
    })

    // 日付が変わっていたら0（日本時間00:00基準）
    const todayUsage = shouldResetDailyUsage(sub?.lastUsageReset) ? 0 : (sub?.dailyUsage || 0)
    const monthlyUsage = sub?.monthlyUsage || 0

    return NextResponse.json({
      totalBanners: totalCount,
      todayUsage,
      monthlyUsage,
    })
  } catch (e: any) {
    console.error('[banner stats] failed', e)
    return NextResponse.json({ error: '統計の取得に失敗しました' }, { status: 500 })
  }
}

