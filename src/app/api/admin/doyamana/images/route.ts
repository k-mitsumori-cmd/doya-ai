import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2, GENRES } from '@/lib/banner-prompts-v2'

export const dynamic = 'force-dynamic'

// V2プロンプトのマップを作成（templateId -> V2プロンプト情報）
const v2PromptsMap = new Map(BANNER_PROMPTS_V2.map(p => [p.id, p]))

// 画像一覧取得（BannerTemplateテーブルを使用、V2プロンプトのgenreを参照）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const genre = searchParams.get('category') // フロントエンドからはcategoryとして送られるが、実際はgenre
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // フィルタ条件構築
    const where: Record<string, unknown> = {}
    
    // genreフィルタ: V2プロンプトのgenreに基づいてtemplateIdでフィルタ
    let filteredTemplateIds: string[] | null = null
    if (genre && genre !== 'all') {
      // 指定されたgenreに一致するV2プロンプトのIDを取得
      filteredTemplateIds = BANNER_PROMPTS_V2
        .filter(p => p.genre === genre)
        .map(p => p.id)
      
      if (filteredTemplateIds.length > 0) {
        where.templateId = { in: filteredTemplateIds }
      }
    }
    
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }
    // 'all' の場合はフィルタなし
    
    if (search) {
      where.OR = [
        { prompt: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { templateId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [images, total] = await Promise.all([
      prisma.bannerTemplate.findMany({
        where,
        orderBy: [
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bannerTemplate.count({ where })
    ])

    // フロントエンド用にデータを整形（V2プロンプトのgenreを使用）
    // 画像URLはサービスと同じAPIエンドポイントを使用
    const formattedImages = images.map(img => {
      const v2Prompt = v2PromptsMap.get(img.templateId)
      // サービスと同じ画像APIエンドポイントを使用
      const imageApiUrl = `/api/banner/test/image/${img.templateId}`
      return {
        id: img.id,
        templateId: img.templateId,
        // V2プロンプトのgenreを優先、なければDBのindustryを使用
        category: v2Prompt?.genre || img.industry,
        industry: v2Prompt?.genre || img.industry,
        prompt: v2Prompt?.fullPrompt || img.prompt,
        promptSummary: (v2Prompt?.fullPrompt || img.prompt).substring(0, 50) + ((v2Prompt?.fullPrompt || img.prompt).length > 50 ? '...' : ''),
        // サービスと同じ画像URLを使用（一貫性のため）
        imageUrl: imageApiUrl,
        previewUrl: imageApiUrl,
        isActive: img.isActive,
        isFeatured: img.isFeatured,
        size: img.size,
        createdAt: img.createdAt,
        updatedAt: img.updatedAt,
        // 追加情報
        displayTitle: v2Prompt?.displayTitle || '',
        name: v2Prompt?.name || '',
      }
    })

    return NextResponse.json({
      images: formattedImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/images] Error:', error)
    return NextResponse.json(
      { error: '画像一覧の取得に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}

// 画像新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, industry, category, prompt, size, imageUrl, previewUrl, isFeatured, isActive } = body

    if (!templateId || !industry || !category || !prompt) {
      return NextResponse.json(
        { error: 'テンプレートID、業種、カテゴリ、プロンプトは必須です' },
        { status: 400 }
      )
    }

    const image = await prisma.bannerTemplate.create({
      data: {
        templateId,
        industry,
        category,
        prompt,
        size: size || '1200x628',
        imageUrl,
        previewUrl,
        isFeatured: isFeatured || false,
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({ image })
  } catch (error) {
    console.error('[POST /api/admin/doyamana/images] Error:', error)
    return NextResponse.json(
      { error: '画像の作成に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}

// 一括操作
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ids } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'アクションとIDリストは必須です' },
        { status: 400 }
      )
    }

    let result
    switch (action) {
      case 'delete':
        // 物理削除（サービス上からも削除される）
        result = await prisma.bannerTemplate.deleteMany({
          where: { id: { in: ids } }
        })
        break
      case 'activate':
        result = await prisma.bannerTemplate.updateMany({
          where: { id: { in: ids } },
          data: { isActive: true }
        })
        break
      case 'deactivate':
        result = await prisma.bannerTemplate.updateMany({
          where: { id: { in: ids } },
          data: { isActive: false }
        })
        break
      default:
        return NextResponse.json(
          { error: '不明なアクションです' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('[PATCH /api/admin/doyamana/images] Error:', error)
    return NextResponse.json(
      { error: '一括操作に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}
