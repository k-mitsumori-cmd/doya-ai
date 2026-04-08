// ============================================
// POST /api/adsim/projects/[projectId]/banners
// ============================================
// NanoBanana AI Pro と連携して、広告提案内容に合わせた
// 正方形バナー画像を 3枚 自動生成する。

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// プラン → 1日あたりのバナー生成回数
function getBannerDailyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.ADSIM_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE' || p === 'BUSINESS' || p === 'BUNDLE') return -1
  if (p === 'PRO' || p === 'STARTER') return -1
  if (p === 'LIGHT') return 10
  return 2 // FREE
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.adSimProject.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ----- 1日あたりのバナー生成制限チェック -----
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const dailyLimit = getBannerDailyLimit(user?.plan)
    if (dailyLimit !== -1) {
      // 当日 0:00 を JST 基準で
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      // ユーザーの全プロジェクトを取得し、当日の bannerGeneratedAt をカウント
      const allProjects = await prisma.adSimProject.findMany({
        where: { userId },
        select: { chartData: true },
      })
      let todayCount = 0
      for (const p of allProjects) {
        const cd = p.chartData as any
        if (cd?.bannerGeneratedAt) {
          const ts = new Date(cd.bannerGeneratedAt)
          if (!isNaN(ts.getTime()) && ts >= startOfDay) todayCount++
        }
      }
      if (todayCount >= dailyLimit) {
        return NextResponse.json(
          {
            error: `本日のバナー生成上限（無料プラン: ${dailyLimit}回/日）に達しました。Pro プランへアップグレードで無制限になります。`,
            code: 'BANNER_DAILY_LIMIT',
            limit: dailyLimit,
            current: todayCount,
          },
          { status: 402 }
        )
      }
    }

    // 提案内容からプロンプト材料を組み立て
    const chartData = (project.chartData as any) || {}
    const proposalText = (project.proposalText as any) || []
    const recommendation = chartData.recommendation || ''
    const summarySection = Array.isArray(proposalText)
      ? proposalText.find((s: any) => s.key === 'summary')?.content || ''
      : ''

    const category = String(chartData.industryName || project.industry || 'その他').substring(0, 60)
    // キーワード = 商材名 + 提案要点 (最大 200文字)
    const keyword = `${project.productName} ${recommendation || summarySection}`
      .replace(/\s+/g, ' ')
      .substring(0, 200)

    // NanoBanana 呼び出し（正方形 1080x1080 / 3枚）
    const result = await generateBanners(
      category,
      keyword,
      '1080x1080',
      {
        purpose: 'sns',
        variationMode: 'diverse',
      } as any,
      3
    )

    if (!result || !result.banners || result.banners.length === 0) {
      return NextResponse.json(
        { error: result?.error || 'バナー生成に失敗しました' },
        { status: 500 }
      )
    }

    // chartData.bannerImages + 生成日時を保存
    const updatedChartData = {
      ...chartData,
      bannerImages: result.banners,
      bannerGeneratedAt: new Date().toISOString(),
    }
    await prisma.adSimProject.update({
      where: { id: params.projectId },
      data: { chartData: updatedChartData as unknown as object },
    })

    return NextResponse.json({ ok: true, banners: result.banners })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] banners error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
