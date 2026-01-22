import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// カテゴリ一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where = activeOnly ? { isActive: true } : {}

    const categories = await prisma.doyamanaCategory.findMany({
      where,
      include: {
        _count: {
          select: { images: true }
        },
        ...(includeStats && {
          images: {
            where: { isDeleted: false },
            select: {
              usageCount: true,
            }
          }
        })
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // 統計情報を計算
    const categoriesWithStats = categories.map(cat => {
      const totalUsage = includeStats && cat.images 
        ? cat.images.reduce((sum, img) => sum + img.usageCount, 0)
        : 0
      
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        order: cat.order,
        isActive: cat.isActive,
        imageCount: cat._count.images,
        totalUsage,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }
    })

    return NextResponse.json({ categories: categoriesWithStats })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/categories] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリ一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

// カテゴリ新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, description, order, isActive } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'カテゴリ名とスラッグは必須です' },
        { status: 400 }
      )
    }

    // スラッグの重複チェック
    const existing = await prisma.doyamanaCategory.findUnique({
      where: { slug }
    })
    if (existing) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      )
    }

    const category = await prisma.doyamanaCategory.create({
      data: {
        name,
        slug,
        description,
        order: order || 0,
        isActive: isActive !== false,
      }
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('[POST /api/admin/doyamana/categories] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリの作成に失敗しました' },
      { status: 500 }
    )
  }
}
