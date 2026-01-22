import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 画像詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const image = await prisma.doyamanaImage.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        },
        _count: {
          select: { usageLogs: true }
        }
      }
    })

    if (!image) {
      return NextResponse.json(
        { error: '画像が見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ image })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の取得に失敗しました' },
      { status: 500 }
    )
  }
}

// 画像更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { categoryId, imageUrl, thumbnailUrl, fileName, mimeType, width, height, prompt, order, isActive } = body

    // プロンプト冒頭を自動生成
    const promptSummary = prompt ? prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '') : undefined

    const image = await prisma.doyamanaImage.update({
      where: { id },
      data: {
        ...(categoryId && { categoryId }),
        ...(imageUrl && { imageUrl }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(fileName !== undefined && { fileName }),
        ...(mimeType && { mimeType }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(prompt && { prompt, promptSummary }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    })

    return NextResponse.json({ image })
  } catch (error) {
    console.error('[PUT /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の更新に失敗しました' },
      { status: 500 }
    )
  }
}

// 画像削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    if (permanent) {
      // 物理削除
      await prisma.doyamanaImage.delete({
        where: { id }
      })
    } else {
      // 論理削除
      await prisma.doyamanaImage.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の削除に失敗しました' },
      { status: 500 }
    )
  }
}
