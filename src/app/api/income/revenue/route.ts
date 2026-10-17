export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { badRequest } from '@/lib/income/access'
import { addMonthsYm, formatYmd, isMonthKey, parseYmd, toDbDate, todayJst } from '@/lib/income/dates'
import { readJson, withIncome } from '@/lib/income/route'

/** その月に計上する売上予定（＝請求すべき一覧） */
export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const month = new URL(req.url).searchParams.get('month') || todayJst().slice(0, 7)
    if (!isMonthKey(month)) return badRequest('月の指定が正しくありません')
    const { y, m } = parseYmd(`${month}-01`)
    const next = addMonthsYm(y, m, 1)
    const schedules = await prisma.incomeRevenueSchedule.findMany({
      where: { organizationId: ctx.organizationId, period: { gte: toDbDate(`${month}-01`), lt: toDbDate(formatYmd(next.y, next.m, 1)) } },
      include: {
        client: { select: { id: true, name: true } },
        contract: { select: { id: true, title: true, items: { select: { taxRate: true }, take: 1 } } },
        invoiceItem: { select: { invoice: { select: { id: true, invoiceNo: true, status: true } } } },
      },
      orderBy: [{ plannedIssueDate: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ month, today: todayJst(), schedules })
  })
}
