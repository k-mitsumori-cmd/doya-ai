import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-guard'
import { isReservedDoyamanaCategory, listDoyamanaCategories } from '@/lib/doyamana-categories'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // ⚠️ 管理者APIは各ルートが自分で認証する（middlewareは見ていない）
  const denied = await requireAdmin()
  if (denied) return denied

  try {
    const { categories } = await listDoyamanaCategories()
    const activeOnly = new URL(request.url).searchParams.get('activeOnly') === 'true'
    return NextResponse.json({ categories: activeOnly ? categories.filter(category => category.isActive) : categories })
  } catch (error) {
    console.error('[GET /api/admin/doyamana/categories] Error:')
    return NextResponse.json(
      { error: 'カテゴリ一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
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
    const [sameName, sameSlug, usedTemplate] = await Promise.all([
      prisma.doyamanaCategory.findFirst({ where: { name }, select: { id: true } }),
      prisma.doyamanaCategory.findUnique({ where: { slug }, select: { id: true } }),
      prisma.bannerTemplate.findFirst({ where: { OR: [{ industry: name }, { category: slug }] }, select: { id: true } }),
    ])
    if (sameName || sameSlug || usedTemplate) {
      return NextResponse.json({ error: '同じ名前かスラッグのカテゴリが既にあります' }, { status: 409 })
    }
    const category = await prisma.doyamanaCategory.create({
      data: { name, slug, description, order: body.order as number, isActive: body.isActive },
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    if (error instanceof OperationalBodyError) {
      return NextResponse.json({ error: 'カテゴリの入力内容が不正です' }, { status: error.status })
    }
    console.error('[POST /api/admin/doyamana/categories] Error:')
    return NextResponse.json({ error: 'カテゴリの作成に失敗しました' }, { status: 500 })
  }
}
