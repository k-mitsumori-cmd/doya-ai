export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/quote/documents — 見積書一覧
// POST /api/quote/documents — 見積書を作成（品目つき）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { defaultExpiry, nextQuoteNo, recalcDocument } from '@/lib/quote/document'
import { assertFreeLimit } from '@/lib/plan-limit'
import { recordServiceUsage } from '@/lib/service-usage'
import type { PriceSource } from '@/lib/quote/types'

export async function GET(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const documents = await prisma.quoteDocument.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, quoteNo: true, title: true, clientCompany: true, status: true,
      issueDate: true, expiryDate: true, totalInclTax: true, createdAt: true,
    },
  })
  return NextResponse.json({ documents })
}

const VALID_SOURCES: PriceSource[] = ['own_price', 'market', 'competitor', 'manual', 'unknown']

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // 無料枠の上限（services.ts の「見積書3件まで」を実際に効かせる）
  const quota = await assertFreeLimit('quoteDocuments', () =>
    prisma.quoteDocument.count({ where: { organizationId: ctx.organizationId } })
  )
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 402 })

  const body = await req.json().catch(() => ({}))

  const title = String(body?.title || '').trim() || 'お見積り'
  const items: any[] = Array.isArray(body?.items) ? body.items.slice(0, 60) : []

  // 商材は自組織のものだけを紐付ける（他組織のIDを渡されても無視する）
  let productId: string | null = null
  if (body?.productId) {
    const p = await prisma.quoteProduct.findFirst({
      where: { id: String(body.productId), organizationId: ctx.organizationId },
      select: { id: true },
    })
    productId = p?.id ?? null
  }

  const issuer = await prisma.quoteIssuer.findUnique({ where: { organizationId: ctx.organizationId } })

  // 採番の衝突（同時作成）に備えて数回やり直す
  let doc = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const quoteNo = await nextQuoteNo(ctx.organizationId)
    try {
      doc = await prisma.quoteDocument.create({
        data: {
          organizationId: ctx.organizationId,
          productId,
          quoteNo,
          title: title.slice(0, 200),
          clientCompany: body?.clientCompany ? String(body.clientCompany).slice(0, 200) : null,
          clientDept: body?.clientDept ? String(body.clientDept).slice(0, 200) : null,
          clientPerson: body?.clientPerson ? String(body.clientPerson).slice(0, 200) : null,
          expiryDate: body?.expiryDate ? new Date(body.expiryDate) : defaultExpiry(),
          paymentTerms: body?.paymentTerms ? String(body.paymentTerms).slice(0, 2000) : issuer?.paymentTerms ?? null,
          deliveryTerms: body?.deliveryTerms ? String(body.deliveryTerms).slice(0, 2000) : issuer?.deliveryTerms ?? null,
          notes: body?.notes ? String(body.notes).slice(0, 2000) : issuer?.notes ?? null,
          lineItems: {
            create: items
              .filter((i) => i && i.itemName)
              .map((i, idx) => ({
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
          },
        },
        select: { id: true, quoteNo: true },
      })
      break
    } catch (err: any) {
      // P2002 = unique制約違反。採番が競合しただけなのでやり直す
      if (err?.code !== 'P2002') throw err
    }
  }
  if (!doc) return NextResponse.json({ error: '見積書を作成できませんでした' }, { status: 500 })

  await recalcDocument(doc.id)

  // 利用記録。⚠️ 失敗しても見積書作成は壊さない（throwしない実装）
  void recordServiceUsage({
    userId: ctx.userId,
    serviceId: 'quote',
    action: '見積書を作成',
    summary: `${title}${body?.clientCompany ? ` / ${String(body.clientCompany)}` : ''}`,
    count: items.length,
  })

  return NextResponse.json({ id: doc.id, quoteNo: doc.quoteNo })
}
