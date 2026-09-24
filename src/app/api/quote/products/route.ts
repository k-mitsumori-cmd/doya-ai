export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/quote/products — 商材一覧
// POST /api/quote/products — 商材を登録（URL解析つき）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'

export async function GET(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const where = { organizationId: ctx.organizationId }
  if (cursor && !await prisma.quoteProduct.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([
    prisma.quoteProduct.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 101,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.quoteProduct.count({ where }),
  ])
  const products = rows.slice(0, 100)
  return NextResponse.json({
    products,
    total,
    nextCursor: rows.length > 100 ? products[products.length - 1].id : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: '商材名を入力してください' }, { status: 400 })

  const product = await prisma.quoteProduct.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      sourceUrl: body?.sourceUrl ? String(body.sourceUrl).slice(0, 500) : null,
      profile: (body?.profile ?? null) as any,
    },
  })
  return NextResponse.json({ product })
}
