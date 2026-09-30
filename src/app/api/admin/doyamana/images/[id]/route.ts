import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-guard'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'
import { bannerAdminImageExists } from '@/lib/banner-admin-image-storage'
import { resolveDoyamanaCategorySelection } from '@/lib/doyamana-categories'

export const dynamic = 'force-dynamic'

// 画像詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

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
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const body = await readOperationalJson(request, 64 * 1024)
    const { templateId, industry, category, categoryId, prompt, size, imageUrl, previewUrl, isFeatured, isActive } = body

    if ((templateId !== undefined && (typeof templateId !== 'string' || !templateId.trim() || templateId.length > 100)) ||
        (industry !== undefined && (typeof industry !== 'string' || !industry.trim() || industry.length > 100)) ||
        (category !== undefined && (typeof category !== 'string' || !category.trim() || category.length > 100)) ||
        (categoryId !== undefined && (typeof categoryId !== 'string' || !categoryId.trim() || categoryId.length > 100)) ||
        (prompt !== undefined && (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000)) ||
        (size !== undefined && (typeof size !== 'string' || !/^\d{2,5}x\d{2,5}$/.test(size))) ||
        (imageUrl !== undefined && imageUrl !== null && (typeof imageUrl !== 'string' || !await bannerAdminImageExists(imageUrl))) ||
        (previewUrl !== undefined && previewUrl !== null && (typeof previewUrl !== 'string' || previewUrl.length > 2048)) ||
        (isFeatured !== undefined && typeof isFeatured !== 'boolean') ||
        (isActive !== undefined && typeof isActive !== 'boolean')) {
      return NextResponse.json({ error: '更新内容が不正です' }, { status: 400 })
    }

    const current = await prisma.bannerTemplate.findUnique({
      where: { id }, select: { templateId: true, industry: true, category: true },
    })
    if (!current) return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 })
    if (templateId !== undefined && templateId !== current.templateId) {
      return NextResponse.json({ error: 'テンプレートIDは変更できません' }, { status: 409 })
    }
    if ((industry !== undefined && industry !== current.industry) ||
        (category !== undefined && category !== current.category)) {
      return NextResponse.json({ error: 'カテゴリは一覧から選択してください' }, { status: 400 })
    }
    const selection = typeof categoryId === 'string'
      ? await resolveDoyamanaCategorySelection(categoryId, current) : null
    if (categoryId !== undefined && !selection) {
      return NextResponse.json({ error: '選択したカテゴリは利用できません' }, { status: 400 })
    }

    const image = await prisma.bannerTemplate.update({
      where: { id },
      data: {
        ...(selection && { industry: selection.industry, category: selection.category }),
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
    if (error instanceof OperationalBodyError) {
      return NextResponse.json({ error: error.status === 413 ? '更新内容が大きすぎます' : 'リクエストが不正です' }, { status: error.status })
    }
    console.error('[PUT /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の更新に失敗しました' },
      { status: 500 }
    )
  }
}

// 画像削除（物理削除 - サービス上からも削除される）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params

    await prisma.bannerTemplate.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/doyamana/images/[id]] Error:', error)
    return NextResponse.json(
      { error: '画像の削除に失敗しました' },
      { status: 500 }
    )
  }
}
