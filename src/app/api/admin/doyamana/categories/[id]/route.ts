import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-guard'
import { isReservedDoyamanaCategory, listDoyamanaCategories } from '@/lib/doyamana-categories'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params

    const { categories, templateIds } = await listDoyamanaCategories()
    const category = categories.find(item => item.id === id)

    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリが見つかりません' },
        { status: 404 }
      )
    }

    const templates = await prisma.bannerTemplate.findMany({
      where: { id: { in: templateIds.get(id) || [] } },
      select: { id: true, templateId: true, prompt: true, isActive: true, sortOrder: true, createdAt: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      category,
      stats: {
        totalImages: category.imageCount,
        activeImages: category.activeImageCount,
      },
      images: templates.map(template => ({
        id: template.id,
        imageUrl: `/api/banner/test/image/${encodeURIComponent(template.templateId)}`,
        promptSummary: template.prompt.slice(0, 100),
        isActive: template.isActive,
        order: template.sortOrder,
        createdAt: template.createdAt,
      })),
    })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/categories/[id]] Error:')
    return NextResponse.json(
      { error: 'カテゴリの取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const existing = await prisma.doyamanaCategory.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: '追加カテゴリが見つかりません。標準カテゴリは編集できません' }, { status: 404 })
    const previousName = existing.name
    const previousSlug = existing.slug
    const body = await readOperationalJson(request, 16 * 1024)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    const description = body.description === null ? null : typeof body.description === 'string' ? body.description.trim() : null
    if (!name || name.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60 ||
        (body.description !== null && body.description !== undefined && typeof body.description !== 'string') ||
        (description && description.length > 1000) ||
        !Number.isInteger(body.order) || (body.order as number) < 0 || (body.order as number) > 100000 ||
        typeof body.isActive !== 'boolean' || isReservedDoyamanaCategory(name, slug)) {
      return NextResponse.json({ error: 'カテゴリの入力内容が不正か、標準カテゴリと重複しています' }, { status: 400 })
    }
    const [sameName, sameSlug, usedByOther, imageCount] = await Promise.all([
      prisma.doyamanaCategory.findFirst({ where: { name, NOT: { id } }, select: { id: true } }),
      prisma.doyamanaCategory.findFirst({ where: { slug, NOT: { id } }, select: { id: true } }),
      prisma.bannerTemplate.findFirst({
        where: { OR: [{ industry: name }, { category: slug }], NOT: { category: previousSlug } },
        select: { id: true },
      }),
      prisma.bannerTemplate.count({ where: { category: previousSlug } }),
    ])
    if (sameName || sameSlug || usedByOther) {
      return NextResponse.json({ error: '同じ名前かスラッグのカテゴリが既にあります' }, { status: 409 })
    }
    if (slug !== previousSlug && imageCount > 0) {
      return NextResponse.json({ error: '画像が登録されているカテゴリのスラッグは変更できません' }, { status: 409 })
    }
    const category = await prisma.$transaction(async transaction => {
      const updated = await transaction.doyamanaCategory.update({
        where: { id },
        data: { name, slug, description, order: body.order as number, isActive: body.isActive as boolean },
      })
      if (name !== previousName && imageCount > 0) {
        await transaction.bannerTemplate.updateMany({
          where: { category: previousSlug }, data: { industry: name },
        })
      }
      return updated
    })

    return NextResponse.json({ category })
  } catch (error) {
    if (error instanceof OperationalBodyError) return NextResponse.json({ error: 'カテゴリの入力内容が不正です' }, { status: error.status })
    console.error('[PUT /api/admin/doyamana/categories/[id]] Error:')
    return NextResponse.json(
      { error: 'カテゴリの更新に失敗しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { id } = await params

    const category = await prisma.doyamanaCategory.findUnique({ where: { id } })
    if (!category) return NextResponse.json({ error: '追加カテゴリが見つかりません。標準カテゴリは削除できません' }, { status: 404 })
    const [imageCount, legacyImageCount] = await Promise.all([
      prisma.bannerTemplate.count({ where: { category: category.slug } }),
      prisma.doyamanaImage.count({ where: { categoryId: id } }),
    ])

    if (imageCount + legacyImageCount > 0) {
      return NextResponse.json(
        { error: `このカテゴリには${imageCount + legacyImageCount}件の画像が登録されているため削除できません` },
        { status: 409 }
      )
    }

    await prisma.doyamanaCategory.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/doyamana/categories/[id]] Error:')
    return NextResponse.json(
      { error: 'カテゴリの削除に失敗しました' },
      { status: 500 }
    )
  }
}
