import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2, GENRES } from '@/lib/banner-prompts-v2'

export const dynamic = 'force-dynamic'

// V2プロンプトのマップを作成（templateId -> V2プロンプト情報）
const v2PromptsMap = new Map(BANNER_PROMPTS_V2.map(p => [p.id, p]))

// カテゴリ一覧取得（V2プロンプトのgenreを使用）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'

    // BannerTemplateからテンプレートIDを取得
    const templates = await prisma.bannerTemplate.findMany({
      select: {
        templateId: true,
        isActive: true,
      }
    })

    // V2プロンプトのgenreごとに集計
    const genreMap = new Map<string, {
      name: string,
      slug: string,
      imageCount: number,
      activeCount: number,
    }>()

    templates.forEach(t => {
      // V2プロンプトからgenreを取得
      const v2Prompt = v2PromptsMap.get(t.templateId)
      const genre = v2Prompt?.genre || 'その他'
      
      const existing = genreMap.get(genre)
      if (existing) {
        existing.imageCount++
        if (t.isActive) existing.activeCount++
      } else {
        genreMap.set(genre, {
          name: genre, // genreはすでに日本語名
          slug: genre, // slugもgenreを使用
          imageCount: 1,
          activeCount: t.isActive ? 1 : 0,
        })
      }
    })

    // 配列に変換
    const categories = Array.from(genreMap.entries()).map(([genre, data], index) => ({
      id: genre, // genreをIDとして使用
      name: data.name,
      slug: data.slug,
      description: `${data.imageCount}件の画像`,
      order: index,
      isActive: true,
      imageCount: data.imageCount,
      activeImageCount: data.activeCount,
      totalUsage: 0, // 使用回数は別途トラッキングが必要
    }))

    // GENRES定義の順序でソート（定義されていないものは最後）
    const genreOrder = GENRES.map(g => g.name)
    categories.sort((a, b) => {
      const aIndex = genreOrder.indexOf(a.name)
      const bIndex = genreOrder.indexOf(b.name)
      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name, 'ja')
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/categories] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリ一覧の取得に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}
