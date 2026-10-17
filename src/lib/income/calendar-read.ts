// ============================================
// ドヤ収入管理: カレンダーに載せる予定（読み取り専用。ADDON-SERVICES §4・R-4）
// ============================================
// ホームのカレンダー（仮）・ICS（Phase2）・エージェント道具が同じ関数を呼ぶ。
// 予定は保存せず、契約・売上予定・請求書から毎回作る（請求漏れ・遅延と同じく読むときに計算。設計書 §4.2-3）。
import { prisma } from '@/lib/prisma'
import { addDays, fromDbDate, isYmd, toDbDate, todayJst, type Ymd } from './dates'
import type { ReadCtx } from './summary-read'

import { buildCalendarEvents, type IncomeCalendarEvent } from './calendar-events'
export { buildCalendarEvents, CALENDAR_KIND_LABEL, type IncomeCalendarEvent, type IncomeCalendarKind, type CalendarSource } from './calendar-events'

/** 予定の一覧（from / to は 'YYYY-MM-DD'、両端を含む。最大 400 日） */
export async function listCalendarEvents(ctx: ReadCtx, from: Ymd, to: Ymd, today: Ymd = todayJst()): Promise<IncomeCalendarEvent[]> {
  if (!isYmd(from) || !isYmd(to) || from > to || addDays(from, 400) < to) throw new Error('期間の指定が正しくありません')
  const orgId = ctx.organizationId
  const range = { gte: toDbDate(from), lte: toDbDate(to) }
  const [schedules, invoices, contracts] = await Promise.all([
    prisma.incomeRevenueSchedule.findMany({
      where: { organizationId: orgId, status: 'planned', plannedIssueDate: range },
      select: { id: true, plannedIssueDate: true, amountExclTax: true, period: true, client: { select: { name: true } }, contract: { select: { title: true } } },
    }),
    prisma.incomeInvoice.findMany({
      where: { organizationId: orgId, status: { in: ['confirmed', 'sent'] }, dueDate: range },
      select: { id: true, invoiceNo: true, dueDate: true, totalInclTax: true, paidAmount: true, client: { select: { name: true } } },
    }),
    // 解約予告期限は終了日より前に来るので、終了日は to より最大 1 年先まで見る
    prisma.incomeContract.findMany({
      where: { organizationId: orgId, status: 'active', endDate: { gte: toDbDate(from), lte: toDbDate(addDays(to, 366)) } },
      select: { id: true, title: true, endDate: true, autoRenew: true, renewalNoticeDays: true, client: { select: { name: true } } },
    }),
  ])
  return buildCalendarEvents(
    {
      schedules: schedules.map((s) => ({ id: s.id, plannedIssueDate: fromDbDate(s.plannedIssueDate), amountExclTax: s.amountExclTax, clientName: s.client.name, contractTitle: s.contract.title, periodMonth: fromDbDate(s.period).slice(0, 7) })),
      invoices: invoices.map((i) => ({ id: i.id, invoiceNo: i.invoiceNo, dueDate: fromDbDate(i.dueDate), remaining: i.totalInclTax - i.paidAmount, clientName: i.client.name })),
      contracts: contracts.map((c) => ({ id: c.id, title: c.title, clientName: c.client.name, endDate: fromDbDate(c.endDate!), autoRenew: c.autoRenew, renewalNoticeDays: c.renewalNoticeDays })),
    },
    from,
    to,
    today,
  )
}

/** 入金予定（資金繰り Phase3 の CashInEvent。支出設計書 §8.5）。支払期日に残高が入る想定 */
export async function listCashInEvents(ctx: ReadCtx, from: Ymd, to: Ymd) {
  const events = await listCalendarEvents(ctx, from, to)
  return events.filter((e) => e.kind === 'payment_due').map((e) => ({ date: e.date, amount: e.amount ?? 0, label: e.title, late: e.late }))
}
