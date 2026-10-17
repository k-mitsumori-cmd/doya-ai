export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withExpense } from '@/lib/expense/access'
import { hasAmountDiff } from '@/lib/expense/aggregate'
import { BILL_MISSING_DAYS } from '@/lib/expense/constants'
import { addDays, addMonthsToYm, firstOfMonth, fromDbDate, todayJst, toDbDate, ymOf } from '@/lib/expense/dates'
import { vendorDto } from '@/lib/expense/dto'
import { toRowLike } from '@/lib/expense/sync'

/**
 * GET /api/expense/contractors?org=&month=2026-11 — 業務委託の一覧（設計書 §5.3）
 * 個人の取引先と、カテゴリ「業務委託」の契約を持つ取引先。その月に支払う額と状態を 1 行にまとめる
 */
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const today = todayJst()
    const qm = req.nextUrl.searchParams.get('month')
    const ym = qm && /^\d{4}-(0[1-9]|1[0-2])$/.test(qm) ? qm : ymOf(today)
    const vendors = await prisma.expenseVendor.findMany({
      where: { organizationId: ctx.organizationId, OR: [{ kind: 'individual' }, { contracts: { some: { category: 'contractor' } } }] },
      include: { contracts: { include: { prices: true } } },
      orderBy: { name: 'asc' },
    })
    const rows = await prisma.expenseSchedule.findMany({
      where: {
        organizationId: ctx.organizationId,
        contract: { vendorId: { in: vendors.map((v) => v.id) } },
        plannedPayDate: { gte: toDbDate(firstOfMonth(ym)), lt: toDbDate(firstOfMonth(addMonthsToYm(ym, 1))) },
      },
      include: { contract: { select: { vendorId: true } } },
    })

    const list = vendors.map((v) => {
      const mine = rows.filter((r) => r.contract?.vendorId === v.id && r.status !== 'skipped').map(toRowLike)
      const active = v.contracts.filter((c) => c.status === 'active')
      const main = active[0] ?? v.contracts[0] ?? null
      const flags: string[] = []
      for (const r of mine) {
        if (r.status === 'planned' && addDays(r.plannedPayDate, -BILL_MISSING_DAYS) <= today && r.plannedPayDate >= today) flags.push('bill_missing')
        if (r.status !== 'paid' && r.plannedPayDate < today) flags.push('overdue')
        if (hasAmountDiff(r) && r.status !== 'planned') flags.push('amount_diff')
      }
      const statuses = Array.from(new Set(mine.map((r) => r.status)))
      const endDates = active.map((c) => (c.autoRenew ? null : c.endDate ? fromDbDate(c.endDate) : null))
      return {
        vendor: vendorDto(v, ctx),
        contractCount: active.length,
        billingModel: main?.billingModel ?? null,
        frequencyMonths: main?.frequencyMonths ?? null,
        withholding: active.some((c) => c.withholding),
        endDate: endDates.includes(null) || !endDates.length ? null : endDates.sort().slice(-1)[0],
        autoRenew: active.some((c) => c.autoRenew),
        month: {
          netPayAmount: mine.reduce((s, r) => s + (r.status === 'paid' && r.paidAmount != null ? r.paidAmount : r.netPayAmount), 0),
          amountExclTax: mine.reduce((s, r) => s + r.amountExclTax, 0),
          withholding: mine.reduce((s, r) => s + r.withholdingAmount, 0),
          // 一番手前の状態（予定 < 請求書受領 < 承認済み < 支払済み）を代表にする
          status: mine.length ? (['planned', 'billed', 'approved', 'paid'].find((s) => statuses.includes(s)) ?? 'planned') : null,
          scheduleIds: mine.map((r) => r.id),
          payDate: mine.map((r) => r.plannedPayDate).sort()[0] ?? null,
        },
        flags: Array.from(new Set(flags)),
      }
    })
    return NextResponse.json({
      month: ym,
      contractors: list,
      total: list.reduce((s, x) => s + x.month.netPayAmount, 0),
    })
  })
}
