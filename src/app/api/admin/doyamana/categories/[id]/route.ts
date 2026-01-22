import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// カテゴリ詳細取得（使用回数可視化含む）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const category = await prisma.doyamanaCategory.findUnique({
      where: { id },
      include: {
        images: {
          where: { isDeleted: false },
          select: {
            id: true,
            imageUrl: true,
            thumbnailUrl: true,
            promptSummary: true,
            usageCount: true,
            isActive: true,
            order: true,
            createdAt: true,
          },
          orderBy: [
            { usageCount: 'desc' },
            { order: 'asc' }
          ]
        },
        _count: {
          select: { images: true }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリが見つかりません' },
        { status: 404 }
      )
    }

    // 統計計算
    const totalUsage = category.images.reduce((sum, img) => sum + img.usageCount, 0)
    const activeImageCount = category.images.filter(img => img.isActive).length

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        order: category.order,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
      stats: {
        totalImages: category._count.images,
        activeImages: activeImageCount,
        totalUsage,
      },
      images: category.images,
    })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/categories/[id]] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリの取得に失敗しました' },
      { status: 500 }
    )
  }
}

// カテゴリ更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, slug, description, order, isActive } = body

    // スラッグの重複チェック（自分以外）
    if (slug) {
      const existing = await prisma.doyamanaCategory.findFirst({
        where: {
          slug,
          NOT: { id }
        }
      })
      if (existing) {
        return NextResponse.json(
          { error: 'このスラッグは既に使用されています' },
          { status: 400 }
        )
      }
    }

    const category = await prisma.doyamanaCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      }
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('[PUT /api/admin/doyamana/categories/[id]] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリの更新に失敗しました' },
      { status: 500 }
    )
  }
}

// カテゴリ削除（使用中は不可）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 使用中チェック
    const imageCount = await prisma.doyamanaImage.count({
      where: { categoryId: id, isDeleted: false }
    })

    if (imageCount > 0) {
      return NextResponse.json(
        { error: `このカテゴリには${imageCount}件の画像が登録されているため削除できません。先に画像を削除または移動してください。` },
        { status: 400 }
      )
    }

    await prisma.doyamanaCategory.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/doyamana/categories/[id]] Error:', error)
    return NextResponse.json(
      { error: 'カテゴリの削除に失敗しました' },
      { status: 500 }
    )
  }
}
