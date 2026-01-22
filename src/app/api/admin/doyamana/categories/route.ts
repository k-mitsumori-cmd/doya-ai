import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// カテゴリ一覧取得（BannerTemplateから動的に取得）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'

    // BannerTemplateからユニークなカテゴリと業種を取得
    const templates = await prisma.bannerTemplate.findMany({
      select: {
        category: true,
        industry: true,
        isActive: true,
      }
    })

    // カテゴリごとに集計
    const categoryMap = new Map<string, {
      name: string,
      slug: string,
      imageCount: number,
      activeCount: number,
      industries: Set<string>
    }>()

    templates.forEach(t => {
      const existing = categoryMap.get(t.category)
      if (existing) {
        existing.imageCount++
        if (t.isActive) existing.activeCount++
        existing.industries.add(t.industry)
      } else {
        categoryMap.set(t.category, {
          name: getCategoryDisplayName(t.category),
          slug: t.category,
          imageCount: 1,
          activeCount: t.isActive ? 1 : 0,
          industries: new Set([t.industry])
        })
      }
    })

    // 配列に変換
    const categories = Array.from(categoryMap.entries()).map(([slug, data], index) => ({
      id: slug, // カテゴリスラッグをIDとして使用
      name: data.name,
      slug: data.slug,
      description: `${Array.from(data.industries).join(', ')}`,
      order: index,
      isActive: true,
      imageCount: data.imageCount,
      activeImageCount: data.activeCount,
      totalUsage: 0, // 使用回数は別途トラッキングが必要
    }))

    // 名前でソート
    categories.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/categories] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリ一覧の取得に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}

// カテゴリ表示名のマッピング
function getCategoryDisplayName(slug: string): string {
  const displayNames: Record<string, string> = {
    'it': 'IT・テクノロジー',
    'ec': 'EC・通販',
    'recruit': '採用・HR',
    'beauty': '美容・コスメ',
    'food': '飲料・食品',
    'fashion': 'ファッション',
    'education': '教育・学習',
    'finance': '金融・保険',
    'realestate': '不動産',
    'medical': '医療・ヘルスケア',
    'travel': '旅行・観光',
    'entertainment': 'エンタメ',
    'sports': 'スポーツ',
    'lifestyle': 'ライフスタイル',
    'business': 'ビジネス・BtoB',
  }
  return displayNames[slug] || slug
}
