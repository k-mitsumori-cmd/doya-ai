export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/aishodan/products/[id]/sources — 取り込み済みナレッジ一覧
// POST /api/aishodan/products/[id]/sources — FAQ・想定問答を手入力で追加
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'
import { ingestManual } from '@/lib/aishodan/knowledge'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // ⚠️ id だけで引かない。必ず organizationId との二重条件にする
  const product = await prisma.aishodanProduct.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })

  const sources = await prisma.aishodanSource.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, url: true, title: true, createdAt: true, _count: { select: { chunks: true } } },
  })
  return NextResponse.json({ sources })
}

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const product = await prisma.aishodanProduct.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const text = String(body?.text || '').trim()
  if (!text) return NextResponse.json({ error: '内容を入力してください' }, { status: 400 })

  const title = String(body?.title || '手入力のナレッジ').slice(0, 200)
  const count = await ingestManual(product.id, title, text.slice(0, 100000))
  return NextResponse.json({ chunkCount: count })
}
