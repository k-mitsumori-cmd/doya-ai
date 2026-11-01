export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/quote/documents/[id]/pdf — 見積書PDFをその場でダウンロード
// 商談中に開いて渡すのが主用途なので、保存を挟まず直接返す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { quoteExpectedRevision, assertQuoteDocumentRevision, QuoteDocumentRevisionError } from '@/lib/quote/document-revision'
import { generateQuotePdf } from '@/lib/quote/pdf'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  let expectedRevision: string
  try {
    const versions = new URL(req.url).searchParams.getAll('expectedRevision')
    if (versions.length > 1) return NextResponse.json({ error: '見積書の版の指定が正しくありません。' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    expectedRevision = quoteExpectedRevision(versions[0])
  } catch (error) {
    if (error instanceof QuoteDocumentRevisionError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
    throw error
  }

  const doc = await prisma.quoteDocument.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: { lineItems: { orderBy: { ord: 'asc' } } },
  })
  if (!doc) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })

  // 発行元は未設定でもよい。商談中にその場で出したい場面があるため、
  // 埋まっていない項目は印字せず、社名だけ手書き用の空欄としてPDFに出す。
  // ⚠️ ここを必須に戻さないこと（未設定を理由に400を返すとPDFが一切出せなくなる）。
  const issuer = await prisma.quoteIssuer.findUnique({ where: { organizationId: ctx.organizationId } })

  try {
    await assertQuoteDocumentRevision(prisma, doc, expectedRevision)
    const pdf = await generateQuotePdf({
      quoteNo: doc.quoteNo,
      title: doc.title,
      status: doc.status,
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate,
      clientCompany: doc.clientCompany,
      clientDept: doc.clientDept,
      clientPerson: doc.clientPerson,
      issuer: {
        companyName: issuer?.companyName ?? null,
        postalCode: issuer?.postalCode ?? null,
        address: issuer?.address ?? null,
        tel: issuer?.tel ?? null,
        personName: issuer?.personName ?? null,
        invoiceNo: issuer?.invoiceNo ?? null,
      },
      lineItems: doc.lineItems.map((l) => ({
        itemName: l.itemName,
        spec: l.spec,
        qty: l.qty,
        unit: l.unit,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        priceSource: l.priceSource,
      })),
      discountType: doc.discountType,
      discountValue: doc.discountValue,
      paymentTerms: doc.paymentTerms,
      deliveryTerms: doc.deliveryTerms,
      notes: doc.notes,
    })

    // ⚠️ ファイル名に日本語や記号が入ると環境によって壊れる。
    //    ASCIIのフォールバックと RFC5987 の両方を出す。
    const asciiName = `${doc.quoteNo}.pdf`
    const utf8Name = encodeURIComponent(`お見積書_${doc.clientCompany || doc.title}_${doc.quoteNo}.pdf`)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof QuoteDocumentRevisionError) return NextResponse.json({ error: err.message }, { status: err.status, headers: { 'Cache-Control': 'private, no-store' } })
    console.error('[quote] pdf failed')
    return NextResponse.json({ error: 'PDFの生成に失敗しました' }, { status: 500 })
  }
}
