export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { ExpenseHttpError, withExpense } from '@/lib/expense/access'
import { addDays, diffDays, todayJst } from '@/lib/expense/dates'
import { listCalendarEvents } from '@/lib/expense/expense-read'
import { date } from '@/lib/expense/validate'

// GET /api/expense/calendar?org=&from=YYYY-MM-DD&to=YYYY-MM-DD — 支払日・源泉税の納付日・契約の更新日・終了日（最長 400 日）
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const sp = req.nextUrl.searchParams
    const from = date(sp.get('from') || todayJst(), '開始日')!
    const to = date(sp.get('to') || addDays(from, 60), '終了日')!
    if (diffDays(from, to) < 0 || diffDays(from, to) > 400) throw new ExpenseHttpError(400, '期間は 400 日以内で指定してください')
    return NextResponse.json({ events: await listCalendarEvents(ctx.organizationId, from, to) })
  })
}
