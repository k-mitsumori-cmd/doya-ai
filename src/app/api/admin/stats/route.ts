import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

// cookies() を使用するため、静的最適化を無効化（ビルド時SSGで落ちるのを防ぐ）
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    // 今日の開始時刻（UTC）
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setUTCHours(0, 0, 0, 0)

    // 今月の開始時刻
    const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)

    // 先月の開始・終了
    const lastMonthStart = new Date(monthStart)
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
    const lastMonthEnd = new Date(monthStart)
    lastMonthEnd.setMilliseconds(-1)

    // 各統計を個別に取得（エラーハンドリング付き）
    let totalUsers = 0
    let proUsers = 0
    let stripeUsers = 0
    let totalGenerations = 0
    let todayGenerations = 0
    let monthGenerations = 0
    let lastMonthGenerations = 0
    let recentUsers = 0
    let recentGenerations: any[] = []
    let adminLoginAttempts = 0

    // ユーザー統計
    try {
      totalUsers = await prisma.user.count()
    } catch (e) {
      console.log('User count failed:', e)
    }

    // PRO/BUSINESS/ENTERPRISEユーザー
    try {
      proUsers = await prisma.user.count({ 
        where: { 
          plan: { in: ['PRO', 'BUSINESS', 'ENTERPRISE'] }
        } 
      })
    } catch (e) {
      console.log('Pro user count failed:', e)
    }

    // Stripe連携ユーザー
    try {
      stripeUsers = await prisma.user.count({ 
        where: { stripeSubscriptionId: { not: null } } 
      })
    } catch (e) {
      console.log('Stripe user count failed:', e)
    }

    // 今週の新規ユーザー
    try {
      recentUsers = await prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      })
    } catch (e) {
      console.log('Recent user count failed:', e)
    }

    // 生成統計
    try {
      totalGenerations = await prisma.generation.count()
    } catch (e) {
      console.log('Generation count failed:', e)
    }

    try {
      todayGenerations = await prisma.generation.count({
        where: { createdAt: { gte: todayStart } },
      })
    } catch (e) {
      console.log('Today generation count failed:', e)
    }

    try {
      monthGenerations = await prisma.generation.count({
        where: { createdAt: { gte: monthStart } },
      })
    } catch (e) {
      console.log('Month generation count failed:', e)
    }

    try {
      lastMonthGenerations = await prisma.generation.count({
        where: {
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      })
    } catch (e) {
      console.log('Last month generation count failed:', e)
    }

    // 最近の生成（24時間）
    try {
      recentGenerations = await prisma.generation.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    } catch (e) {
      console.log('Recent generations failed:', e)
    }

    // 管理者ログイン試行
    try {
      adminLoginAttempts = await prisma.adminLoginAttempt.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      })
    } catch (e) {
      console.log('Admin login attempt count failed:', e)
    }

    // サービス別統計
    const serviceStats: any[] = []
    const serviceIds = ['banner', 'seo']
    const serviceLabels: Record<string, { name: string; icon: string; gradient: string }> = {
      banner: { name: 'ドヤバナーAI', icon: '🎨', gradient: 'from-violet-500 to-fuchsia-500' },
      seo: { name: 'ドヤSEO', icon: '🧠', gradient: 'from-emerald-500 to-green-500' },
    }

    for (const serviceId of serviceIds) {
      try {
        // サービス別ユーザー数
        const serviceUsers = await prisma.userServiceSubscription.count({
          where: { serviceId },
        })

        // サービス別PROユーザー
        const serviceProUsers = await prisma.userServiceSubscription.count({
          where: { serviceId, plan: { in: ['PRO', 'BUSINESS', 'ENTERPRISE'] } },
        })

        // サービス別生成数
        const serviceGenerations = await prisma.generation.count({
          where: { serviceId },
        })

        // サービス別今日の生成
        const serviceTodayGenerations = await prisma.generation.count({
          where: { serviceId, createdAt: { gte: todayStart } },
        })

        // サービス別先月の生成
        const serviceLastMonthGenerations = await prisma.generation.count({
          where: { serviceId, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        })

        // サービス別今月の生成
        const serviceMonthGenerations = await prisma.generation.count({
          where: { serviceId, createdAt: { gte: monthStart } },
        })

        // 成長率
        const growth = serviceLastMonthGenerations > 0
          ? ((serviceMonthGenerations - serviceLastMonthGenerations) / serviceLastMonthGenerations * 100)
          : (serviceMonthGenerations > 0 ? 100 : 0)

        // 売上計算（PRO: banner=3980, seo=3000, kantan=4980）
        const priceMap: Record<string, number> = { banner: 3980, seo: 3000, kantan: 4980 }
        const revenue = serviceProUsers * (priceMap[serviceId] || 0)

        const label = serviceLabels[serviceId]
        serviceStats.push({
          id: serviceId,
          name: label.name,
          icon: label.icon,
          gradient: label.gradient,
          users: serviceUsers,
          proUsers: serviceProUsers,
          generations: serviceGenerations,
          todayGenerations: serviceTodayGenerations,
          revenue,
          growth: parseFloat(growth.toFixed(1)),
        })
      } catch (e) {
        console.log(`Service stats failed for ${serviceId}:`, e)
      }
    }

    // 時系列データ（過去12時間の生成数）
    const hourlyData: number[] = []
    try {
      for (let i = 11; i >= 0; i--) {
        const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
        hourStart.setMinutes(0, 0, 0)
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
        
        const count = await prisma.generation.count({
          where: {
            createdAt: { gte: hourStart, lt: hourEnd },
          },
        })
        hourlyData.push(count)
      }
    } catch (e) {
      console.log('Hourly data failed:', e)
      // フォールバック: 0埋め
      for (let i = 0; i < 12; i++) hourlyData.push(0)
    }

    // 無料ユーザー数
    const freeUsers = Math.max(0, totalUsers - proUsers)

    // コンバージョン率
    const conversionRate = totalUsers > 0 
      ? parseFloat(((proUsers / totalUsers) * 100).toFixed(1))
      : 0

    // 生成数の前月比
    const generationGrowth = lastMonthGenerations > 0
      ? parseFloat((((monthGenerations - lastMonthGenerations) / lastMonthGenerations) * 100).toFixed(1))
      : (monthGenerations > 0 ? 100 : 0)

    // 平均生成数/ユーザー
    const avgGenerationsPerUser = totalUsers > 0
      ? parseFloat((totalGenerations / totalUsers).toFixed(1))
      : 0

    // 月間売上計算（サービス別合計）
    const monthlyRevenue = serviceStats.reduce((sum, s) => sum + s.revenue, 0)

    return NextResponse.json({
      // 基本統計
      totalUsers,
      premiumUsers: proUsers,
      enterpriseUsers: stripeUsers,
      freeUsers,
      
      // 生成統計
      totalGenerations,
      todayGenerations,
      monthGenerations,
      lastMonthGenerations,
      generationGrowth,
      avgGenerationsPerUser,
      
      // 収益統計
      monthlyRevenue,
      mrr: monthlyRevenue,
      
      // KPI
      conversionRate,
      
      // サービス別
      services: serviceStats,
      
      // 時系列（過去12時間）
      chartData: hourlyData,
      
      // 最近のアクティビティ
      recentUsers,
      recentGenerations: recentGenerations.map((g: any) => ({
        id: g.id,
        userName: g.user?.name || g.user?.email || '匿名',
        service: g.serviceId || 'unknown',
        action: g.serviceId === 'banner' ? 'バナーを生成' : g.serviceId === 'seo' ? 'SEO記事を生成' : 'テキストを生成',
        createdAt: g.createdAt,
      })),
      
      // セキュリティ
      adminLoginAttempts,
      
      // メタ情報
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { 
        error: '統計データの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
