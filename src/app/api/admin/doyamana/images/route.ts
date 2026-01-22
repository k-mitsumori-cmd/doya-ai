import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 画像一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const status = searchParams.get('status') // 'active' | 'inactive' | 'deleted' | 'all'
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // フィルタ条件構築
    const where: Record<string, unknown> = {}
    
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }
    
    if (status === 'active') {
      where.isActive = true
      where.isDeleted = false
    } else if (status === 'inactive') {
      where.isActive = false
      where.isDeleted = false
    } else if (status === 'deleted') {
      where.isDeleted = true
    } else {
      // 'all' または未指定の場合は論理削除されていないものを表示
      where.isDeleted = false
    }
    
    if (search) {
      where.OR = [
        { prompt: { contains: search, mode: 'insensitive' } },
        { promptSummary: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [images, total] = await Promise.all([
      prisma.doyamanaImage.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true }
          },
          _count: {
            select: { usageLogs: true }
          }
        },
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.doyamanaImage.count({ where })
    ])

    return NextResponse.json({
      images,
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
      { error: '画像一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

// 画像新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { categoryId, imageUrl, thumbnailUrl, fileName, mimeType, width, height, prompt, order, isActive } = body

    if (!categoryId || !imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'カテゴリ、画像、プロンプトは必須です' },
        { status: 400 }
      )
    }

    // プロンプト冒頭を自動生成
    const promptSummary = prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')

    const image = await prisma.doyamanaImage.create({
      data: {
        categoryId,
        imageUrl,
        thumbnailUrl,
        fileName,
        mimeType: mimeType || 'image/png',
        width,
        height,
        prompt,
        promptSummary,
        order: order || 0,
        isActive: isActive !== false,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    })

    return NextResponse.json({ image })
  } catch (error) {
    console.error('[POST /api/admin/doyamana/images] Error:', error)
    return NextResponse.json(
      { error: '画像の作成に失敗しました' },
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
        // 論理削除
        result = await prisma.doyamanaImage.updateMany({
          where: { id: { in: ids } },
          data: { isDeleted: true, deletedAt: new Date() }
        })
        break
      case 'activate':
        result = await prisma.doyamanaImage.updateMany({
          where: { id: { in: ids } },
          data: { isActive: true }
        })
        break
      case 'deactivate':
        result = await prisma.doyamanaImage.updateMany({
          where: { id: { in: ids } },
          data: { isActive: false }
        })
        break
      case 'restore':
        // 論理削除から復元
        result = await prisma.doyamanaImage.updateMany({
          where: { id: { in: ids } },
          data: { isDeleted: false, deletedAt: null }
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
      { error: '一括操作に失敗しました' },
      { status: 500 }
    )
  }
}
