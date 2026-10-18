export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { fromDbDate, toDbDate } from '@/lib/income/dates'
import { suggestMatches } from '@/lib/income/matching'
import { asBody, date, int, reqInt, str } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'

/** 入金一覧。未消込の入金には照合候補（ルール）を付ける */
export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const [payments, openInvoices] = await Promise.all([
      prisma.incomePayment.findMany({
        where: { organizationId: ctx.organizationId },
        include: { allocations: { include: { invoice: { select: { id: true, invoiceNo: true, client: { select: { name: true } } } } } } },
        orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      }),
      prisma.incomeInvoice.findMany({
        where: { organizationId: ctx.organizationId, status: { in: ['confirmed', 'sent'] } },
        include: { client: { select: { name: true, payerNameKana: true } } },
        orderBy: { dueDate: 'asc' },
      }),
    ])
    const open = openInvoices
      .map((i) => ({ id: i.id, invoiceNo: i.invoiceNo, clientName: i.client.name, payerNameKana: i.client.payerNameKana, remaining: i.totalInclTax - i.paidAmount, dueDate: fromDbDate(i.dueDate), totalInclTax: i.totalInclTax }))
      .filter((i) => i.remaining > 0)
    return NextResponse.json({
      payments: payments.map((p) => ({
        ...p,
        candidates: p.status === 'matched' ? [] : suggestMatches({ amount: p.amount + p.feeDeducted - p.allocations.reduce((a, x) => a + x.amount, 0), payerName: p.payerName }, open).slice(0, 3),
      })),
      openInvoices: open,
    })
  })
}

export async function POST(req: NextRequest) {
  return withIncome(req, 'manager', async (ctx) => {
    const body = asBody(await readJson(req))
    const payment = await prisma.incomePayment.create({
      data: {
        organizationId: ctx.organizationId,
        receivedOn: toDbDate(date(body, 'receivedOn', '入金日', true)!),
        amount: reqInt(body, 'amount', '入金額', { min: 1 }),
        feeDeducted: int(body, 'feeDeducted', '振込手数料の差引', { min: 0, max: 10_000 }) ?? 0,
        payerName: str(body, 'payerName', '振込名義', { max: 100 }),
        memo: str(body, 'memo', 'メモ', { max: 500 }),
        source: 'manual',
        createdByUserId: ctx.userId,
      },
    })
    await audit(prisma, ctx, 'payment.create', 'payment', payment.id, { amount: payment.amount })
    return NextResponse.json({ payment }, { status: 201 })
  })
}
