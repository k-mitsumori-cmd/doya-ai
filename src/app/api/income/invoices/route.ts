export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { findOrCreateClientByName } from '@/lib/income/client-quick'
import { createDraft, INVOICE_STATUSES, paymentState } from '@/lib/income/invoices'
import { invoiceDraft } from '@/lib/income/parse'
import { runWithTxRetry } from '@/lib/income/retry'
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
    const { newClientName, ...input } = invoiceDraft(await readJson(req))
    // 同じ名前の取引先を同時に作ったとき（P2034）や採番の衝突（P2002）はやり直す。2 回目は、先にできた取引先を使う
    const invoice = await runWithTxRetry(() => prisma.$transaction(async (tx) => {
      // 取引先が名前で渡されたら、同じトランザクションの中で作る（同じ名前があればそれを使う）
      const clientId = newClientName ? (await findOrCreateClientByName(tx, ctx, newClientName, 'invoice')).id : input.clientId
      return createDraft(tx, ctx, { ...input, clientId })
    }, { isolationLevel: 'Serializable' }))
    await audit(prisma, ctx, 'invoice.create', 'invoice', invoice.id)
    return NextResponse.json({ invoice }, { status: 201 })
  })
}
