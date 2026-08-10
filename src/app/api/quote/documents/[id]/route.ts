export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET    /api/quote/documents/[id] — 見積書の詳細
// PATCH  /api/quote/documents/[id] — 更新（明細まるごと差し替え／確定）
// DELETE /api/quote/documents/[id] — 削除
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, hasMinRole, orgSlugFrom } from '@/lib/quote/access'
import { recalcDocument } from '@/lib/quote/document'
import type { PriceSource } from '@/lib/quote/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

const VALID_SOURCES: PriceSource[] = ['own_price', 'market', 'competitor', 'manual', 'unknown']

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // ⚠️ id だけで引かない。必ず organizationId との二重条件にする
  const doc = await prisma.quoteDocument.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: { lineItems: { orderBy: { ord: 'asc' } }, product: { select: { id: true, name: true } } },
  })
  if (!doc) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })

  const issuer = await prisma.quoteIssuer.findUnique({ where: { organizationId: ctx.organizationId } })
  return NextResponse.json({ document: doc, issuer })
}

export async function PATCH(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const existing = await prisma.quoteDocument.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!existing) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  for (const f of ['title', 'clientCompany', 'clientDept', 'clientPerson', 'paymentTerms', 'deliveryTerms', 'notes'] as const) {
    if (f in body) {
      const v = body[f]
      data[f] = v == null || String(v).trim() === '' ? null : String(v).slice(0, 2000)
    }
  }
  if ('expiryDate' in body && body.expiryDate) {
    const d = new Date(body.expiryDate)
    if (!Number.isNaN(d.getTime())) data.expiryDate = d
  }
  if ('discountType' in body) {
    data.discountType = body.discountType === 'rate' || body.discountType === 'amount' ? body.discountType : null
  }
  if ('discountValue' in body) {
    data.discountValue = Number.isFinite(Number(body.discountValue)) ? Math.max(0, Math.round(Number(body.discountValue))) : 0
  }

  // --- ステータス遷移 ---
  // ⚠️ AIが出した金額をそのまま客先に出させないため、確定は人の明示操作にする。
  //    確定は manager 以上（金額の責任を負う立場）に限る。
  if ('status' in body) {
    const next = String(body.status)
    if (!['draft', 'confirmed', 'sent'].includes(next)) {
      return NextResponse.json({ error: 'ステータスが不正です' }, { status: 400 })
    }
    if (next !== 'draft' && !hasMinRole(ctx.role, 'manager')) {
      return NextResponse.json({ error: '見積書を確定する権限がありません' }, { status: 403 })
    }
    data.status = next
    if (next === 'confirmed') {
      data.confirmedBy = ctx.userId
      data.confirmedAt = new Date()
    } else if (next === 'sent') {
      data.sentAt = new Date()
    } else {
      // 下書きに戻したら確定の記録は消す（誰がいつ確定したかを偽らせない）
      data.confirmedBy = null
      data.confirmedAt = null
    }
  }

  // --- 確定後の金額変更を禁じる ---
  // ⚠️ status ガードは status フィールドしか守っていなかったため、
  //    確定済み（confirmedBy/confirmedAt 記録済み・PDFの「社内確認用」透かしも消えた）
  //    見積書の単価を後から書き換えられた。承認の記録が、誰も承認していない金額を
  //    承認済みとして証明する状態になる。
  //    金額に関わる変更は下書きに戻してから行わせる。
  const nextStatus = typeof data.status === 'string' ? (data.status as string) : existing.status
  const touchesAmounts =
    Array.isArray(body?.items) || 'discountType' in body || 'discountValue' in body
  if (touchesAmounts && existing.status !== 'draft' && nextStatus !== 'draft') {
    return NextResponse.json(
      {
        error:
          '確定済みの見積書の金額は変更できません。金額を直す場合は、いったん下書きに戻してから編集してください。',
      },
      { status: 409 }
    )
  }

  // --- 明細の差し替え ---
  if (Array.isArray(body?.items)) {
    const items = body.items.slice(0, 60).filter((i: any) => i && i.itemName)
    await prisma.$transaction([
      prisma.quoteLineItem.deleteMany({ where: { documentId: existing.id } }),
      prisma.quoteLineItem.createMany({
        data: items.map((i: any, idx: number) => ({
          documentId: existing.id,
          ord: idx,
          itemName: String(i.itemName).slice(0, 200),
          spec: i.spec ? String(i.spec).slice(0, 1000) : null,
          qty: Number.isFinite(Number(i.qty)) ? Math.max(1, Math.round(Number(i.qty))) : 1,
          unit: String(i.unit || '式').slice(0, 12),
          unitPrice: Number.isFinite(Number(i.unitPrice)) ? Math.max(0, Math.round(Number(i.unitPrice))) : 0,
          taxRate: Number(i.taxRate) === 8 ? 8 : 10,
          priceSource: VALID_SOURCES.includes(i.priceSource) ? i.priceSource : 'manual',
          sourceRef: i.sourceRef ? String(i.sourceRef).slice(0, 1000) : null,
          rangeMin: Number.isFinite(Number(i.rangeMin)) ? Math.round(Number(i.rangeMin)) : null,
          rangeMax: Number.isFinite(Number(i.rangeMax)) ? Math.round(Number(i.rangeMax)) : null,
        })),
      }),
    ])
  }

  if (Object.keys(data).length > 0) {
    await prisma.quoteDocument.update({ where: { id: existing.id }, data })
  }
  await recalcDocument(existing.id)

  const updated = await prisma.quoteDocument.findUnique({
    where: { id: existing.id },
    include: { lineItems: { orderBy: { ord: 'asc' } } },
  })
  return NextResponse.json({ document: updated })
}

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const deleted = await prisma.quoteDocument.deleteMany({
    where: { id: p.id, organizationId: ctx.organizationId },
  })
  if (deleted.count === 0) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
