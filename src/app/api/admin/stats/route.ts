import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { summarizeRegisteredPlans } from '@/lib/admin-registered-plan-stats'
import { getServiceById, RETIRED_SERVICE_IDS } from '@/lib/services'
import { serviceLabelOf } from '@/lib/attribution'
import { jstDayRange, jstMonthRange, jstDateKey } from '@/lib/jst'

// cookies() を使用するため、静的最適化を無効化（ビルド時SSGで落ちるのを防ぐ）
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401, headers: privateHeaders })
    }

    // すべての期間を同じ時刻・日本時間の半開区間で集計する。
    const now = new Date()
    const { start: todayStart, end: todayEnd } = jstDayRange(now)
    const { start: monthStart, end: monthEnd } = jstMonthRange(now)
    const { start: lastMonthStart } = jstMonthRange(monthStart.getTime() - 1)
    const lastMonthEnd = monthStart
    const dayOfMonth = Number(jstDateKey(now)!.slice(-2))

    // 集計に失敗した場合は外側で失敗を返し、0件として表示しない。

    // ユーザー統計

    const planRows = await prisma.user.groupBy({ by: ['plan'], _count: { _all: true } })
    const { totalUsers, paidPlanUsers: proUsers, registeredPlanTiers } = summarizeRegisteredPlans(planRows)

    // Stripe連携ユーザー

    const stripeUsers = await prisma.user.count({
      where: { stripeSubscriptionId: { not: null } }
    })

    // 過去7日の新規登録（集計時点までの半開区間）

    const recentUsers = await prisma.user.count({
      where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lt: now } },
    })

    // 生成統計

    const totalGenerations = await prisma.generation.count()

    const todayGenerations = await prisma.generation.count({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
    })

    const monthGenerations = await prisma.generation.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
    })

    const lastMonthGenerations = await prisma.generation.count({
      where: {
        createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
      },
    })

    // 最近の生成（24時間）

    const recentGenerations = await prisma.generation.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      // output はバナーだと巨大な dataURL。一覧では絶対に取らない
      select: {
        id: true,
        serviceId: true,
        metadata: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // 管理者ログイン試行

    const adminLoginAttempts = await prisma.adminLoginAttempt.count({
      where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    })

    // サービス別統計
    const serviceStats: any[] = []
    const serviceIds = ['banner', 'writing', 'interview', 'copy', 'lp', 'voice', 'movie', 'hr', 'kintai']
    const serviceLabels: Record<string, { name: string; icon: string; gradient: string }> = {
      banner: { name: 'ドヤバナーAI', icon: '🎨', gradient: 'from-violet-500 to-fuchsia-500' },
      writing: { name: 'ドヤ記事作成', icon: '✍️', gradient: 'from-emerald-500 to-cyan-500' },
      interview: { name: 'ドヤインタビュー', icon: '🎙️', gradient: 'from-rose-500 to-pink-500' },
      copy: { name: 'ドヤコピーAI', icon: '📝', gradient: 'from-amber-500 to-orange-500' },
      lp: { name: 'ドヤLP AI', icon: '📄', gradient: 'from-cyan-500 to-blue-500' },
      voice: { name: 'ドヤボイスAI', icon: '🔊', gradient: 'from-indigo-500 to-violet-500' },
      movie: { name: 'ドヤ動画AI', icon: '🎬', gradient: 'from-pink-500 to-rose-500' },
      hr: { name: 'ドヤHR', icon: '💼', gradient: 'from-blue-500 to-indigo-500' },
      kintai: { name: 'ドヤ勤怠', icon: '⏰', gradient: 'from-purple-500 to-indigo-500' },
    }

    for (const serviceId of serviceIds) {

      const queryServiceId = serviceId === 'writing' ? 'seo' : serviceId

      let serviceUsers: number | null = null
      let serviceProUsers: number | null = null
      let serviceGenerations = 0
      let serviceTodayGenerations = 0
      let serviceLastMonthGenerations = 0
      let serviceMonthGenerations = 0

        // サービス別の集計（Generationテーブルを使うサービスとモデル特化サービスを分岐）
      const usesGeneration = ['banner', 'writing'].includes(serviceId)

      if (usesGeneration) {
        const servicePlanRows = await prisma.userServiceSubscription.groupBy({
          by: ['plan'], where: { serviceId: queryServiceId }, _count: { _all: true },
        })
        const servicePlans = summarizeRegisteredPlans(servicePlanRows)
        serviceUsers = servicePlans.totalUsers
        serviceProUsers = servicePlans.paidPlanUsers
        serviceGenerations = await prisma.generation.count({ where: { serviceId: queryServiceId } })
        serviceTodayGenerations = await prisma.generation.count({ where: { serviceId: queryServiceId, createdAt: { gte: todayStart, lt: todayEnd } } })
        serviceLastMonthGenerations = await prisma.generation.count({ where: { serviceId: queryServiceId, createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } })
        serviceMonthGenerations = await prisma.generation.count({ where: { serviceId: queryServiceId, createdAt: { gte: monthStart, lt: monthEnd } } })
      } else if (serviceId === 'interview') {
        serviceGenerations = await prisma.interviewProject.count()
        serviceTodayGenerations = await prisma.interviewProject.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } })
        serviceMonthGenerations = await prisma.interviewProject.count({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })
        serviceLastMonthGenerations = await prisma.interviewProject.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } })
      } else if (serviceId === 'copy') {
        serviceGenerations = await prisma.copyProject.count()
        serviceTodayGenerations = await prisma.copyProject.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } })
        serviceMonthGenerations = await prisma.copyProject.count({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })
        serviceLastMonthGenerations = await prisma.copyProject.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } })
      } else if (serviceId === 'lp') {
        serviceGenerations = await prisma.lpProject.count()
        serviceTodayGenerations = await prisma.lpProject.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } })
        serviceMonthGenerations = await prisma.lpProject.count({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })
        serviceLastMonthGenerations = await prisma.lpProject.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } })
      } else if (serviceId === 'voice') {
        serviceGenerations = await prisma.voiceProject.count()
        serviceTodayGenerations = await prisma.voiceProject.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } })
        serviceMonthGenerations = await prisma.voiceProject.count({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })
        serviceLastMonthGenerations = await prisma.voiceProject.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } })
      } else if (serviceId === 'movie') {
        serviceGenerations = await prisma.movieProject.count()
        serviceTodayGenerations = await prisma.movieProject.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } })
        serviceMonthGenerations = await prisma.movieProject.count({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })
        serviceLastMonthGenerations = await prisma.movieProject.count({ where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } } })
      } else if (serviceId === 'hr') {
        serviceUsers = await prisma.hrEmployee.count()
        serviceGenerations = await prisma.hrOrganization.count()
        serviceTodayGenerations = await prisma.hrEmployee.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } })
      } else if (serviceId === 'kintai') {
        serviceUsers = await prisma.kintaiEmployee.count()
        serviceGenerations = await prisma.kintaiClockRecord.count()
        serviceTodayGenerations = await prisma.kintaiClockRecord.count({ where: { timestamp: { gte: todayStart, lt: todayEnd } } })
        serviceMonthGenerations = await prisma.kintaiClockRecord.count({ where: { timestamp: { gte: monthStart, lt: monthEnd } } })
        serviceLastMonthGenerations = await prisma.kintaiClockRecord.count({ where: { timestamp: { gte: lastMonthStart, lt: lastMonthEnd } } })
      }

        // 成長率
      const growth = serviceLastMonthGenerations === 0
        ? (serviceMonthGenerations > 0 ? 100 : 0)
        : (serviceMonthGenerations === 0 && dayOfMonth <= 3)
          ? 0
          : ((serviceMonthGenerations - serviceLastMonthGenerations) / serviceLastMonthGenerations * 100)

      const label = serviceLabels[serviceId]
      serviceStats.push({
        id: serviceId,
        dashboardHref: RETIRED_SERVICE_IDS.has(queryServiceId) ? null : getServiceById(queryServiceId)?.dashboardHref ?? null,
        isRetired: RETIRED_SERVICE_IDS.has(queryServiceId),
        name: label.name,
        icon: label.icon,
        gradient: label.gradient,
        users: serviceUsers,
        userCountLabel: usesGeneration ? '個別プラン登録者' : ['hr', 'kintai'].includes(serviceId) ? '従業員' : 'ユーザー',
        proUsers: serviceProUsers,
        generations: serviceGenerations,
        todayGenerations: serviceTodayGenerations,
        revenue: null,
        growth: parseFloat(growth.toFixed(1)),
      })

    }

    // 時系列データ（過去12時間の生成数）
    const hourlyData: number[] = []

    for (let i = 11; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      hourStart.setUTCMinutes(0, 0, 0)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

      const count = await prisma.generation.count({
        where: {
          createdAt: { gte: hourStart, lt: hourEnd },
        },
      })
      hourlyData.push(count)
    }

    // 無料ユーザー数
    const freeUsers = Math.max(0, totalUsers - proUsers)

    // コンバージョン率
    const conversionRate = totalUsers > 0
      ? parseFloat(((proUsers / totalUsers) * 100).toFixed(1))
      : 0

    // 生成数の前月比（月初で当月データがほぼ無い場合は誤解を招くため0扱い）
    const generationGrowth = lastMonthGenerations === 0
      ? (monthGenerations > 0 ? 100 : 0)
      : (monthGenerations === 0 && dayOfMonth <= 3)
        ? 0  // 月初3日以内かつ当月0件は「計測中」扱い（-100%を出さない）
        : parseFloat((((monthGenerations - lastMonthGenerations) / lastMonthGenerations) * 100).toFixed(1))

    // 平均生成数/ユーザー
    const avgGenerationsPerUser = totalUsers > 0
      ? parseFloat((totalGenerations / totalUsers).toFixed(1))
      : 0

    // 登録プランやStripe IDの有無は価格・入金額ではない。
    // 財務指標は独立した認証済みAPIで取得し、DB統計をStripe障害で止めない。

    return NextResponse.json({
      // 基本統計
      totalUsers,
      premiumUsers: proUsers,
      registeredPlanTiers,
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
      monthlyRevenue: null,
      mrr: null,
      financialMetricsEndpoint: '/api/admin/billing/stats',

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
        // 利用ログには metadata.action が入っている（service-usage.ts 経由）。
        // 無い場合はサービス名で代替する
        action:
          (g.metadata && typeof g.metadata === 'object' && (g.metadata as any).action)
            ? `${serviceLabelOf(g.serviceId)}：${(g.metadata as any).action}`
            : g.serviceId === 'banner'
              ? 'バナーを生成'
              : `${serviceLabelOf(g.serviceId)}を利用`,
        createdAt: g.createdAt,
      })),

      // セキュリティ
      adminLoginAttempts,

      // メタ情報
      lastUpdated: now.toISOString(),
    }, { headers: privateHeaders })
  } catch (error) {
    console.error('Admin stats error:')
    return NextResponse.json(
      { error: '統計データの取得に失敗しました' },
      { status: 503, headers: privateHeaders }
    )
  }
}
