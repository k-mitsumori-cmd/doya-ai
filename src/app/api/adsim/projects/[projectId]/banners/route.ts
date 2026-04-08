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

    // chartData.bannerImages に保存
    const updatedChartData = {
      ...chartData,
      bannerImages: result.banners,
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
