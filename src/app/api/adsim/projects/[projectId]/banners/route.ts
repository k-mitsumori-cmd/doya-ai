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

// プラン → 月間バナー生成回数（NanoBanana API コストが高いため厳密管理）
// 1回の生成 = 3枚 のバナー画像
function getBannerMonthlyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.ADSIM_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return 150 // 月150回 = 月450枚
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return 30 // 月30回 = 月90枚
  if (p === 'LIGHT') return 10 // 月10回 = 月30枚
  return 3 // FREE: 月3回 = 月9枚
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

    // ----- 月間バナー生成制限チェック -----
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const monthlyLimit = getBannerMonthlyLimit(user?.plan)
    if (monthlyLimit !== -1) {
      // 当月の1日 0:00
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const allProjects = await prisma.adSimProject.findMany({
        where: { userId },
        select: { chartData: true },
      })
      let monthCount = 0
      for (const p of allProjects) {
        const cd = p.chartData as any
        if (cd?.bannerGeneratedAt) {
          const ts = new Date(cd.bannerGeneratedAt)
          if (!isNaN(ts.getTime()) && ts >= startOfMonth) monthCount++
        }
      }
      if (monthCount >= monthlyLimit) {
        const planLabel =
          String(user?.plan || 'FREE').toUpperCase() === 'FREE'
            ? '無料プラン'
            : `${String(user?.plan).toUpperCase()} プラン`
        return NextResponse.json(
          {
            error: `今月のバナー生成上限（${planLabel}: ${monthlyLimit}回/月）に達しました。上位プランへのアップグレードでさらに利用可能になります。`,
            code: 'BANNER_MONTHLY_LIMIT',
            limit: monthlyLimit,
            current: monthCount,
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
