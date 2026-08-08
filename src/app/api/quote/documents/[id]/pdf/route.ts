export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/quote/documents/[id]/pdf — 見積書PDFをその場でダウンロード
// 商談中に開いて渡すのが主用途なので、保存を挟まず直接返す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, orgSlugFrom } from '@/lib/quote/access'
import { generateQuotePdf } from '@/lib/quote/pdf'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const doc = await prisma.quoteDocument.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: { lineItems: { orderBy: { ord: 'asc' } } },
  })
  if (!doc) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })

  const issuer = await prisma.quoteIssuer.findUnique({ where: { organizationId: ctx.organizationId } })
  if (!issuer) {
    return NextResponse.json(
      { error: '発行元情報が未設定です。設定画面で自社情報を登録してください。' },
      { status: 400 }
    )
  }

  try {
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
        companyName: issuer.companyName,
        postalCode: issuer.postalCode,
        address: issuer.address,
        tel: issuer.tel,
        personName: issuer.personName,
        invoiceNo: issuer.invoiceNo,
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
    const message = err instanceof Error ? err.message : String(err)
    console.error('[quote] pdf failed', message)
    // ⚠️ 一時的な診断用。動作確認後に外すこと。
    return NextResponse.json({ error: 'PDFの生成に失敗しました', detail: message.slice(0, 400) }, { status: 500 })
  }
}
