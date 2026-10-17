export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { createDraft, INVOICE_STATUSES, paymentState } from '@/lib/income/invoices'
import { invoiceDraft } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const sp = new URL(req.url).searchParams
    const status = sp.get('status')
    const clientId = sp.get('clientId')
    const invoices = await prisma.incomeInvoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(status && (INVOICE_STATUSES as readonly string[]).includes(status) ? { status } : {}),
        ...(clientId ? { clientId } : {}),
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    })
    return NextResponse.json({ invoices: invoices.map((i) => ({ ...i, state: paymentState(i) })) })
  })
}

export async function POST(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const input = invoiceDraft(await readJson(req))
    const invoice = await prisma.$transaction((tx) => createDraft(tx, ctx, input))
    await audit(prisma, ctx, 'invoice.create', 'invoice', invoice.id)
    return NextResponse.json({ invoice }, { status: 201 })
  })
}
