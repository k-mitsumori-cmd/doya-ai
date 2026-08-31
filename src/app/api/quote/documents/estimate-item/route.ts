export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/quote/documents/estimate-item — 品目名1件から内訳・数量・単価をAIで埋める
// ⚠️ 保存はしない。画面の1行に差し込むだけで、確定は人が行う。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { estimateItem } from '@/lib/quote/analyze'
import type { ProductProfile } from '@/lib/quote/types'

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const itemName = String(body?.itemName || '').trim()
  if (!itemName) {
    return NextResponse.json({ error: '品目名を入力してください' }, { status: 400 })
  }

  // 商材の文脈があれば精度が上がるが、無くても品目名だけで動く
  let profile: ProductProfile | null = null
  let productName = ''
  if (body?.productId) {
    // 他組織の商材を参照させない
    const p = await prisma.quoteProduct.findFirst({
      where: { id: String(body.productId), organizationId: ctx.organizationId },
    })
    if (p) {
      profile = (p.profile as ProductProfile | null) ?? {}
      productName = p.name
    }
  }

  try {
    const item = await estimateItem({
      itemName: itemName.slice(0, 120),
      spec: body?.spec ? String(body.spec).slice(0, 300) : undefined,
      productName: productName || undefined,
      profile,
    })
    return NextResponse.json({ item })
  } catch (err) {
    console.error('[quote] estimate-item failed', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: '見積もりの生成に失敗しました。時間をおいて再度お試しください。' },
      { status: 502 }
    )
  }
}
