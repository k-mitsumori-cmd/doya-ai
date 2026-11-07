export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { audit, IncomeError } from '@/lib/income/access'
import { createOnce, isOnceResolve, onceOperationId, resolveOnce, type OnceScope } from '@/lib/submit-once'
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
    const body = await readJson(req)
    const fail = (status: number, message: string) => new IncomeError(message, status)
    const once: OnceScope = { family: 'income-invoice', organizationId: ctx.organizationId, actorId: ctx.userId, operationId: onceOperationId(body, fail), fail }
    const find = (db: Prisma.TransactionClient) => (id: string) => db.incomeInvoice.findFirst({ where: { id, organizationId: ctx.organizationId } })
    // 通信に失敗した送信が保存されたかを確かめる（登録はしない）
    if (isOnceResolve(body)) return NextResponse.json({ once: await prisma.$transaction((tx) => resolveOnce(tx, once, find(tx))) })
    const { newClientName, ...input } = invoiceDraft(body)
    // 同じ名前の取引先を同時に作ったとき（P2034）や採番の衝突（P2002）はやり直す。2 回目は、先にできた取引先を使う
    // 同じ送信の送り直しは、受け取りの記録を見て、前にできた請求書を返す
    const { entry: invoice, replayed } = await runWithTxRetry(() => prisma.$transaction((tx) => createOnce<{ id: string }>(tx, once, body, find(tx), async () => {
      // 取引先が名前で渡されたら、同じトランザクションの中で作る（同じ名前があればそれを使う）
      const clientId = newClientName ? (await findOrCreateClientByName(tx, ctx, newClientName, 'invoice')).id : input.clientId
      return createDraft(tx, ctx, { ...input, clientId })
    }), { isolationLevel: 'Serializable' }))
    if (!replayed) await audit(prisma, ctx, 'invoice.create', 'invoice', invoice.id)
    return NextResponse.json({ invoice }, { status: 201 })
  })
}
