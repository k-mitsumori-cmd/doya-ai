export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, notFound } from '@/lib/income/access'
import { deleteDraft, paymentState, updateDraft } from '@/lib/income/invoices'
import { invoiceDraft } from '@/lib/income/parse'
import { idFrom, readJson, withIncome, withIncomeWrite, type IdCtx } from '@/lib/income/route'

export async function GET(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'member', async (ctx) => {
    const id = await idFrom(c)
    const invoice = await prisma.incomeInvoice.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        client: true,
        items: { orderBy: { sortOrder: 'asc' } },
        allocations: { include: { payment: { select: { id: true, receivedOn: true, amount: true, payerName: true } } } },
      },
    })
    if (!invoice) return notFound('請求書が見つかりません')
    // 下書きのプレビューは今の請求元情報で出す（確定後は issuerSnapshot を使う）
    const issuer = invoice.status === 'draft' ? await prisma.incomeIssuer.findUnique({ where: { organizationId: ctx.organizationId } }) : null
    return NextResponse.json({ invoice: { ...invoice, state: paymentState(invoice) }, issuer })
  })
}

export async function PATCH(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'member', async () => ({ id: await idFrom(c), input: invoiceDraft(await readJson(req)) }), async (ctx, tx, { id, input }) => {
    const invoice = await updateDraft(tx, ctx, id, input)
    await audit(tx, ctx, 'invoice.update', 'invoice', id)
    return NextResponse.json({ invoice })
  })
}

export async function DELETE(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'member', () => idFrom(c), async (ctx, tx, id) => {
    await deleteDraft(tx, ctx, id)
    await audit(tx, ctx, 'invoice.delete', 'invoice', id)
    return NextResponse.json({ ok: true })
  })
}
