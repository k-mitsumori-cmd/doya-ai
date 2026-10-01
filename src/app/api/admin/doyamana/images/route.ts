import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2 } from '@/lib/banner-prompts-v2'
import { requireAdmin } from '@/lib/admin-guard'
import { randomUUID } from 'node:crypto'
import { bannerAdminImageExists } from '@/lib/banner-admin-image-storage'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'
import { resolveDoyamanaCategorySelection } from '@/lib/doyamana-categories'

export const dynamic = 'force-dynamic'

// V2プロンプトのマップを作成（templateId -> V2プロンプト情報）
const v2PromptsMap = new Map(BANNER_PROMPTS_V2.map(p => [p.id, p]))

// 画像一覧取得（BannerTemplateテーブルを使用、V2プロンプトのgenreを参照）
export async function GET(request: NextRequest) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const genre = searchParams.get('category')
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'
    const search = searchParams.get('search')
    const rawPage = searchParams.get('page') || '1'
    const rawLimit = searchParams.get('limit') || '20'
    const page = Number(rawPage)
    const limit = Number(rawLimit)
    if (!Number.isInteger(page) || page < 1 || page > 100000 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100 ||
        (search && search.length > 200)) {
      return NextResponse.json({ error: '検索条件またはページ指定が不正です' }, { status: 400 })
    }

    // フィルタ条件構築
    const where: Record<string, unknown> = {}
    
    // 管理カテゴリはslug、標準・既存カテゴリは保存済み業種で絞る。
    if (genre && genre !== 'all') {
      const managedCategory = await prisma.doyamanaCategory.findUnique({
        where: { id: genre }, select: { slug: true },
      })
      if (managedCategory) {
        where.category = managedCategory.slug
      } else {
        where.industry = genre
      }
    }
    
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }
    // 'all' の場合はフィルタなし
    
    if (search) {
      const searchConditions = [
        { prompt: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { templateId: { contains: search, mode: 'insensitive' } },
      ]
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    const [images, total] = await Promise.all([
      prisma.bannerTemplate.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
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
        category: img.industry,
        industry: img.industry,
        prompt: img.prompt,
        promptSummary: img.prompt.substring(0, 50) + (img.prompt.length > 50 ? '...' : ''),
        // サービスと同じ画像URLを使用（一貫性のため）
        imageUrl: `${imageApiUrl}?v=${new Date(img.updatedAt).getTime()}`,
        previewUrl: `${imageApiUrl}?v=${new Date(img.updatedAt).getTime()}`,
        isActive: img.isActive,
        isFeatured: img.isFeatured,
        size: img.size,
        sortOrder: img.sortOrder,
        createdAt: img.createdAt,
        updatedAt: img.updatedAt,
        // 追加情報
        displayTitle: v2Prompt?.genre === img.industry ? (v2Prompt.displayTitle || v2Prompt.name) : img.industry,
        name: v2Prompt?.genre === img.industry ? v2Prompt.name : img.industry,
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
    console.error('[GET /api/admin/doyamana/images] Error:')
    return NextResponse.json(
      { error: '画像一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

// 画像新規作成
export async function POST(request: NextRequest) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readOperationalJson(request, 64 * 1024)
    const { categoryId, order, size, imageUrl, previewUrl, isFeatured, isActive } = body
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const isNewForm = categoryId !== undefined
    const selection = isNewForm && typeof categoryId === 'string'
      ? await resolveDoyamanaCategorySelection(categoryId) : null
    const industry = isNewForm ? selection?.industry : body.industry
    const category = isNewForm ? selection?.category : body.category
    const templateId = isNewForm ? `custom-${randomUUID()}` : body.templateId

    if (typeof templateId !== 'string' || !templateId || templateId.length > 100 ||
        typeof industry !== 'string' || !industry.trim() || industry.length > 100 ||
        typeof category !== 'string' || !category.trim() || category.length > 100 ||
        !prompt || prompt.length > 20000 ||
        (size !== undefined && (typeof size !== 'string' || !/^\d{2,5}x\d{2,5}$/.test(size))) ||
        (imageUrl !== undefined && imageUrl !== null && (typeof imageUrl !== 'string' || imageUrl.length > 2048)) ||
        (previewUrl !== undefined && previewUrl !== null && (typeof previewUrl !== 'string' || previewUrl.length > 2048)) ||
        (isActive !== undefined && typeof isActive !== 'boolean') ||
        (isFeatured !== undefined && typeof isFeatured !== 'boolean') ||
        (order !== undefined && (!Number.isInteger(order) || (order as number) < 0 || (order as number) > 100000)) ||
        (isNewForm && (typeof imageUrl !== 'string' || !await bannerAdminImageExists(imageUrl)))) {
      return NextResponse.json(
        { error: '画像または登録内容が不正です。画像を再アップロードしてください' },
        { status: 400 }
      )
    }

    const image = await prisma.bannerTemplate.create({
      data: {
        templateId,
        industry,
        category,
        prompt,
        size: (size as string | undefined) || '1200x628',
        imageUrl: imageUrl as string | null | undefined,
        previewUrl: previewUrl as string | null | undefined,
        isFeatured: isFeatured === true,
        isActive: isActive !== false,
        sortOrder: typeof order === 'number' ? order : 1000,
      },
    })

    return NextResponse.json({ image })
  } catch (error) {
    if (error instanceof OperationalBodyError) {
      return NextResponse.json({ error: error.status === 413 ? '登録内容が大きすぎます' : 'リクエストが不正です' }, { status: error.status })
    }
    console.error('[POST /api/admin/doyamana/images] Error:')
    return NextResponse.json(
      { error: '画像の作成に失敗しました' },
      { status: 500 }
    )
  }
}

// 一括操作
export async function PATCH(request: NextRequest) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readOperationalJson(request, 16 * 1024)
    const { action, ids } = body

    if (!action || !Array.isArray(ids) || ids.length === 0 || ids.length > 100 ||
        !ids.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 100)) {
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
    if (error instanceof OperationalBodyError) {
      return NextResponse.json({ error: error.status === 413 ? '一括操作の対象が多すぎます' : 'リクエストが不正です' }, { status: error.status })
    }
    console.error('[PATCH /api/admin/doyamana/images] Error:')
    return NextResponse.json(
      { error: '一括操作に失敗しました' },
      { status: 500 }
    )
  }
}
