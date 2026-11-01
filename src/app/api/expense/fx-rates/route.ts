export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { resyncContract } from '@/lib/expense/sync'
import { month, oneOf } from '@/lib/expense/validate'

// GET /api/expense/fx-rates?org=
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const rows = await prisma.expenseFxRate.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ month: 'desc' }] })
    return NextResponse.json({ rates: rows.map((r) => ({ month: r.month, currency: r.currency, rate: Number(r.rate) })) })
  })
}

// PUT /api/expense/fx-rates?org= — { month, currency, rate }。USD の契約の予定を作り直す（admin 以上）
export async function PUT(req: NextRequest) {
  return withExpense(req, 'admin', async (ctx) => {
    const b = await readJson(req)
    const m = month(b.month, '月')
    const currency = oneOf(b.currency, ['USD'] as const, '通貨')
    const rate = typeof b.rate === 'string' ? Number(b.rate) : b.rate
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate >= 100_000) throw new ExpenseHttpError(400, 'レートは 0 より大きい数で入力してください')
    const value = new Prisma.Decimal(rate.toFixed(4))
    await prisma.expenseFxRate.upsert({
      where: { organizationId_month_currency: { organizationId: ctx.organizationId, month: m, currency } },
      create: { organizationId: ctx.organizationId, month: m, currency, rate: value },
      update: { rate: value },
    })
    await audit(prisma, ctx, 'fx.update', 'fx_rate', `${m}:${currency}`, { rate })
    const contracts = await prisma.expenseContract.findMany({ where: { organizationId: ctx.organizationId, currency }, select: { id: true } })
    for (const c of contracts) await resyncContract(ctx.organizationId, c.id)
    return NextResponse.json({ ok: true })
  })
}
