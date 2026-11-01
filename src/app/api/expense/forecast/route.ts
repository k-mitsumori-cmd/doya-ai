export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withExpense } from '@/lib/expense/access'
import { forecastByPayMonth, monthlyExpenses } from '@/lib/expense/aggregate'
import { addMonthsToYm, firstOfMonth, todayJst, toDbDate, ymOf } from '@/lib/expense/dates'
import { toRowLike } from '@/lib/expense/sync'

// GET /api/expense/forecast?org=&months=12 — 出金月×カテゴリ（資金繰り）と、計上月の支出（粗利）
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const n = req.nextUrl.searchParams.get('months') === '6' ? 6 : 12
    const from = ymOf(todayJst())
    const to = addMonthsToYm(from, n - 1)
    // 予定日・支払日・計上月のどれかが範囲に入る行を引く（前後に 1 か月の余裕）
    const lo = toDbDate(firstOfMonth(addMonthsToYm(from, -1)))
    const hi = toDbDate(firstOfMonth(addMonthsToYm(to, 2)))
    const rows = await prisma.expenseSchedule.findMany({
      where: { organizationId: ctx.organizationId, OR: [{ plannedPayDate: { gte: lo, lt: hi } }, { paidOn: { gte: lo, lt: hi } }, { period: { gte: lo, lt: hi } }] },
    })
    const like = rows.map(toRowLike)
    return NextResponse.json({ cash: forecastByPayMonth(like, from, to), accrual: monthlyExpenses(like, from, to) })
  })
}
