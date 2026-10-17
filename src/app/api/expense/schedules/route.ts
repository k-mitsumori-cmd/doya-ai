export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, readJson, withExpense } from '@/lib/expense/access'
import { CATEGORIES } from '@/lib/expense/constants'
import { addMonthsToYm, firstOfMonth, todayJst, toDbDate, ymOf } from '@/lib/expense/dates'
import { scheduleDto } from '@/lib/expense/dto'
import { settle, splitTax } from '@/lib/expense/plan'
import { syncWithholding } from '@/lib/expense/sync'
import { bool, date, money, month, oneOf, str } from '@/lib/expense/validate'

// GET /api/expense/schedules?org=&month=2026-11 — その月に口座から出る予定（出金日で絞る）
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const m = month(req.nextUrl.searchParams.get('month') ?? ymOf(todayJst()), '月')
    const rows = await prisma.expenseSchedule.findMany({
      where: {
        organizationId: ctx.organizationId,
        plannedPayDate: { gte: toDbDate(firstOfMonth(m)), lt: toDbDate(firstOfMonth(addMonthsToYm(m, 1))) },
      },
      include: { contract: { include: { vendor: true } } },
      orderBy: [{ plannedPayDate: 'asc' }, { title: 'asc' }],
    })
    const items = rows.map(scheduleDto)
    const sum = (f: (r: (typeof items)[number]) => boolean) => items.filter(f).reduce((s, r) => s + (r.status === 'paid' && r.paidAmount != null ? r.paidAmount : r.netPayAmount), 0)
    return NextResponse.json({
      month: m,
      schedules: items,
      totals: {
        all: sum((r) => r.status !== 'skipped'),
        paid: sum((r) => r.status === 'paid'),
        unpaid: sum((r) => r.status !== 'paid' && r.status !== 'skipped'),
      },
    })
  })
}

// POST /api/expense/schedules?org= — 単発の支出を追加（manager 以上）
export async function POST(req: NextRequest) {
  return withExpense(req, 'manager', async (ctx) => {
    const b = await readJson(req)
    const payDate = date(b.payDate, '支払日')!
    const taxRate = oneOf(typeof b.taxRate === 'string' ? Number(b.taxRate) : b.taxRate, [10, 8, 0] as const, '税率', 10)
    const { exclTax, tax } = splitTax(money(b.amount, '金額')!, taxRate, bool(b.taxIncluded))
    const s = settle(exclTax, tax, bool(b.withholding))
    const row = await prisma.$transaction(async (tx) => {
      const r = await tx.expenseSchedule.create({
        data: {
          organizationId: ctx.organizationId,
          kind: 'one_time',
          title: str(b.title, '内容', 120)!,
          category: oneOf(b.category, CATEGORIES, 'カテゴリ', 'other'),
          period: toDbDate(firstOfMonth(ymOf(date(b.period, '計上日', false) ?? payDate))),
          plannedPayDate: toDbDate(payDate),
          plannedAmountExclTax: exclTax,
          amountExclTax: exclTax,
          taxAmount: tax,
          ...s,
          note: str(b.note, 'メモ', 1000, false),
        },
      })
      if (s.withholdingAmount > 0) await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'schedule.create', 'schedule', r.id)
      return r
    })
    return NextResponse.json({ schedule: scheduleDto(row) })
  })
}
