import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 画像一覧取得（BannerTemplateテーブルを使用）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // フィルタ条件構築
    const where: Record<string, unknown> = {}
    
    if (category && category !== 'all') {
      where.category = category
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

    console.log('[GET /api/admin/doyamana/images] Query params:', { category, status, search, page, limit })
    console.log('[GET /api/admin/doyamana/images] Where:', JSON.stringify(where))

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
    
    console.log('[GET /api/admin/doyamana/images] Found:', images.length, 'images, total:', total)

    // フロントエンド用にデータを整形
    const formattedImages = images.map(img => ({
      id: img.id,
      templateId: img.templateId,
      category: img.category,
      industry: img.industry,
      prompt: img.prompt,
      promptSummary: img.prompt.substring(0, 50) + (img.prompt.length > 50 ? '...' : ''),
      imageUrl: img.imageUrl,
      previewUrl: img.previewUrl,
      isActive: img.isActive,
      isFeatured: img.isFeatured,
      size: img.size,
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
    }))

    return NextResponse.json({
      images: formattedImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('[GET /api/admin/doyamana/images] Error:', error)
    console.error('[GET /api/admin/doyamana/images] Error stack:', error?.stack)
    return NextResponse.json(
      { error: '画像一覧の取得に失敗しました', details: String(error), stack: error?.stack },
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
