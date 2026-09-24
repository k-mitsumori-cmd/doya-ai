export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/quote/documents — 見積書一覧
// POST /api/quote/documents — 見積書を作成（品目つき）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { defaultExpiry, nextQuoteNo, recalcDocument } from '@/lib/quote/document'
import { assertFreeLimit, FREE_LIMITS, jstStartOfMonthUtc } from '@/lib/plan-limit'
import { recordServiceUsage } from '@/lib/service-usage'
import type { PriceSource } from '@/lib/quote/types'

export async function GET(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const where = { organizationId: ctx.organizationId }
  if (cursor && !await prisma.quoteDocument.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([
    prisma.quoteDocument.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 201,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, quoteNo: true, title: true, clientCompany: true, status: true,
        issueDate: true, expiryDate: true, totalInclTax: true, createdAt: true,
      },
    }),
    prisma.quoteDocument.count({ where }),
  ])
  const documents = rows.slice(0, 200)
  return NextResponse.json({
    documents,
    total,
    nextCursor: rows.length > 200 ? documents[documents.length - 1].id : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

const VALID_SOURCES: PriceSource[] = ['own_price', 'market', 'competitor', 'manual', 'ai_estimate', 'unknown']

export async function POST(req: NextRequest) {
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // 無料枠の上限（services.ts の「見積書3件まで」を実際に効かせる）
  const checkQuota = () => assertFreeLimit(
    'quoteDocuments',
    () => prisma.quoteDocument.count({ where: { organizationId: ctx.organizationId } }),
    undefined,
    (since) =>
      prisma.quoteDocument.count({
        where: { organizationId: ctx.organizationId, createdAt: { gte: since } },
      })
  )
  const quotaResponse = (checked: Awaited<ReturnType<typeof checkQuota>>) => NextResponse.json({
    error: checked.reason,
    code: 'LIMIT_REACHED',
    used: checked.used,
    limit: checked.limit,
    ...(checked.limit === FREE_LIMITS.quoteDocuments ? { upgradeUrl: '/quote/pricing' } : {}),
  }, { status: 402 })
  const quota = await checkQuota()
  if (!quota.ok) return quotaResponse(quota)

  const body = await req.json().catch(() => ({}))

  for (const [field, label] of [['notes', '備考'], ['paymentTerms', '支払条件'], ['deliveryTerms', '納期']] as const) {
    if (body?.[field] != null && String(body[field]).length > 2000) {
      return NextResponse.json({ error: `${label}は2,000文字以内で入力してください。入力内容は保存されていません。` }, { status: 400 })
    }
  }

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
  let result: { kind: 'created'; doc: { id: string; quoteNo: string } } | { kind: 'limit' } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const quoteNo = await nextQuoteNo(ctx.organizationId)
    try {
      result = await prisma.$transaction(async (tx) => {
        // 上限確認と作成を同一の Serializable トランザクションにする。
        // 複数タブで同時に作っても、片方は競合として再試行され上限を超えない。
        const used = await tx.quoteDocument.count({
          where: {
            organizationId: ctx.organizationId,
            ...(quota.limit === FREE_LIMITS.quoteDocuments ? {} : { createdAt: { gte: jstStartOfMonthUtc() } }),
          },
        })
        if (quota.limit !== undefined && used >= quota.limit) return { kind: 'limit' } as const
        const created = await tx.quoteDocument.create({
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
        await recalcDocument(created.id, tx)
        return { kind: 'created', doc: created } as const
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      break
    } catch (err: any) {
      // 採番の衝突か同時作成による直列化競合。最新件数を読み直して再試行する。
      if (err?.code !== 'P2002' && err?.code !== 'P2034') {
        return NextResponse.json({ error: '見積書を作成できませんでした。再読み込みして状態をご確認ください。' }, { status: 500 })
      }
    }
  }
  if (result?.kind === 'limit') {
    // プラン変更が同時に起きた場合は、古い階層のエラーを返さず再操作を促す。
    const latestQuota = await checkQuota()
    if (latestQuota.ok) return NextResponse.json({ error: 'プラン情報が更新されました。再読み込みしてからもう一度お試しください。' }, { status: 409 })
    return quotaResponse(latestQuota)
  }
  if (!result) return NextResponse.json({ error: '見積書を作成できませんでした' }, { status: 500 })
  const doc = result.doc


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
