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

    const image = await prisma.bannerTemplate.findUnique({
      where: { id },
    })

    if (!image) {
      return NextResponse.json(
        { error: '画像が見つかりません' },
        { status: 404 }
      )
    }

    // フロントエンド用にデータを整形
    const formattedImage = {
      id: image.id,
      templateId: image.templateId,
      category: image.category,
      industry: image.industry,
      prompt: image.prompt,
      promptSummary: image.prompt.substring(0, 50) + (image.prompt.length > 50 ? '...' : ''),
      imageUrl: image.imageUrl,
      previewUrl: image.previewUrl,
      isActive: image.isActive,
      isFeatured: image.isFeatured,
      size: image.size,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    }

    return NextResponse.json({ image: formattedImage })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の取得に失敗しました', details: String(error) },
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
    const { templateId, industry, category, prompt, size, imageUrl, previewUrl, isFeatured, isActive } = body

    const image = await prisma.bannerTemplate.update({
      where: { id },
      data: {
        ...(templateId && { templateId }),
        ...(industry && { industry }),
        ...(category && { category }),
        ...(prompt && { prompt }),
        ...(size && { size }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(previewUrl !== undefined && { previewUrl }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ image })
  } catch (error) {
    console.error('[PUT /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の更新に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}

// 画像削除（物理削除 - サービス上からも削除される）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.bannerTemplate.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の削除に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}
