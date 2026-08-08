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
  const products = await prisma.quoteProduct.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ products })
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
