export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/quote/documents/suggest — 商材から見積品目の候補を生成
// ⚠️ 保存はしない。生成物は必ず人が確認・編集してから見積書にする。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { suggestItems } from '@/lib/quote/analyze'
import { sanitizeProductProfile } from '@/lib/quote/profile-input'
import type { ProductProfile } from '@/lib/quote/types'

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    (body.productId != null && (typeof body.productId !== 'string' || body.productId.length > 128)) ||
    (body.productName != null && (typeof body.productName !== 'string' || body.productName.length > 200)) ||
    (body.profile != null && !sanitizeProductProfile(body.profile)) ||
    (body.situation != null && typeof body.situation !== 'string')) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }

  let profile: ProductProfile | null = null
  let productName = (body.productName || '').trim()

  if (body?.productId) {
    // 他組織の商材を参照させない
    const p = await prisma.quoteProduct.findFirst({
      where: { id: String(body.productId), organizationId: ctx.organizationId },
    })
    if (!p) return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })
    profile = sanitizeProductProfile(p.profile) ?? {}
    productName = productName || p.name
  } else if (body?.profile) {
    profile = sanitizeProductProfile(body.profile)
  }

  if (!profile || !productName) {
    return NextResponse.json({ error: '商材を指定してください' }, { status: 400 })
  }

  const budgetRaw = body.budget == null || body.budget === '' ? null : Number(body.budget)
  if (budgetRaw != null && (!Number.isSafeInteger(budgetRaw) || budgetRaw < 0 || budgetRaw > 1_000_000_000_000)) {
    return NextResponse.json({ error: '想定予算は1兆円以下の整数で入力してください' }, { status: 400 })
  }
  try {
    const items = await suggestItems({
      profile,
      productName,
      situation: body.situation ? body.situation.slice(0, 1000) : undefined,
      budget: budgetRaw && budgetRaw > 0 ? budgetRaw : null,
    })
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[quote] suggest failed')
    return NextResponse.json({ error: '品目の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
  }
}
