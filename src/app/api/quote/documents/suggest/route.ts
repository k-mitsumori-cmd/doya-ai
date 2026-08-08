export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/quote/documents/suggest — 商材から見積品目の候補を生成
// ⚠️ 保存はしない。生成物は必ず人が確認・編集してから見積書にする。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { suggestItems } from '@/lib/quote/analyze'
import type { ProductProfile } from '@/lib/quote/types'

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  let profile: ProductProfile | null = null
  let productName = String(body?.productName || '').trim()

  if (body?.productId) {
    // 他組織の商材を参照させない
    const p = await prisma.quoteProduct.findFirst({
      where: { id: String(body.productId), organizationId: ctx.organizationId },
    })
    if (!p) return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })
    profile = (p.profile as ProductProfile | null) ?? {}
    productName = productName || p.name
  } else if (body?.profile) {
    profile = body.profile as ProductProfile
  }

  if (!profile || !productName) {
    return NextResponse.json({ error: '商材を指定してください' }, { status: 400 })
  }

  const budgetRaw = Number(body?.budget)
  try {
    const items = await suggestItems({
      profile,
      productName,
      situation: body?.situation ? String(body.situation).slice(0, 1000) : undefined,
      budget: Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.round(budgetRaw) : null,
    })
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[quote] suggest failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '品目の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
  }
}
