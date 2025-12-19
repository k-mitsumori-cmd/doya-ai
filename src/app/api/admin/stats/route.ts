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

    // 今日の開始時刻
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 今月の開始時刻
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    // 先月の開始・終了
    const lastMonthStart = new Date(monthStart)
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
    const lastMonthEnd = new Date(monthStart)
    lastMonthEnd.setMilliseconds(-1)

    // 各統計を個別に取得（エラーハンドリング付き）
    let totalUsers = 0
    let premiumUsers = 0
    let enterpriseUsers = 0
    let totalGenerations = 0
    let todayGenerations = 0
    let monthGenerations = 0
    let lastMonthGenerations = 0
    let activeTemplates = 0
    let recentUsers = 0
    let recentGenerations: any[] = []
    let adminLoginAttempts = 0

    // ユーザー統計
    try {
      totalUsers = await prisma.user.count()
    } catch (e) {
      console.log('User count failed:', e)
    }

    try {
      premiumUsers = await prisma.user.count({ where: { plan: 'PREMIUM' } })
    } catch (e) {
      console.log('Premium user count failed:', e)
    }

    try {
      enterpriseUsers = await prisma.user.count({ where: { stripeSubscriptionId: { not: null } } })
    } catch (e) {
      console.log('Enterprise user count failed:', e)
    }

    try {
      recentUsers = await prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      })
    } catch (e) {
      console.log('Recent user count failed:', e)
    }

    // 生成統計（Generationテーブルが存在しない場合はスキップ）
    try {
      totalGenerations = await prisma.generation.count()
    } catch (e) {
      console.log('Generation count failed (table may not exist):', e)
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

    try {
      recentGenerations = await prisma.generation.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        include: {
          user: { select: { name: true, email: true } },
          template: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    } catch (e) {
      console.log('Recent generations failed:', e)
    }

    // テンプレート統計
    try {
      activeTemplates = await prisma.template.count({ where: { isActive: true } })
    } catch (e) {
      console.log('Template count failed (table may not exist):', e)
    }

    // 管理者ログイン試行
    try {
      adminLoginAttempts = await prisma.adminLoginAttempt.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      })
    } catch (e) {
      console.log('Admin login attempt count failed:', e)
    }

    // 月間売上計算（プレミアム: 2,980円/月）
    const premiumPrice = 2980
    const monthlyRevenue = premiumUsers * premiumPrice
    const mrr = monthlyRevenue

    // コンバージョン率（無料→有料）
    const freeUsers = Math.max(0, totalUsers - premiumUsers - enterpriseUsers)
    const conversionRate = totalUsers > 0 
      ? ((premiumUsers + enterpriseUsers) / totalUsers * 100).toFixed(1)
      : '0'

    // 生成数の前月比
    const generationGrowth = lastMonthGenerations > 0
      ? (((monthGenerations - lastMonthGenerations) / lastMonthGenerations) * 100).toFixed(1)
      : (monthGenerations > 0 ? '100' : '0')

    // 平均生成数/ユーザー
    const avgGenerationsPerUser = totalUsers > 0
      ? (totalGenerations / totalUsers).toFixed(1)
      : '0'

    return NextResponse.json({
      // 基本統計
      totalUsers,
      premiumUsers,
      enterpriseUsers,
      freeUsers,
      
      // 生成統計
      totalGenerations,
      todayGenerations,
      monthGenerations,
      lastMonthGenerations,
      generationGrowth: parseFloat(generationGrowth),
      avgGenerationsPerUser: parseFloat(avgGenerationsPerUser),
      
      // 収益統計
      monthlyRevenue,
      mrr,
      
      // KPI
      conversionRate: parseFloat(conversionRate),
      churnRate: 0,
      avgSessionTime: 0,
      
      // テンプレート
      activeTemplates,
      
      // 最近のアクティビティ
      recentUsers,
      recentGenerations: recentGenerations.map((g: any) => ({
        id: g.id,
        userName: g.user?.name || g.user?.email || '匿名',
        templateName: g.template?.name || '不明',
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
