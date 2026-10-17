// ============================================
// ドヤ支出管理: 読み取り専用の関数（ADDON-SERVICES §3 R-4・§4・§5）
// ============================================
// API route・ホーム（§4）・エージェントの道具（§5）が同じ関数を呼ぶ。ここでは書き込まない。
// ⚠️ 呼ぶ側が organizationId の所属と権限を確かめてから渡すこと（API は withExpense、エージェントは道具の ctx）
// エージェントの道具（マニフェスト草案は reference/services/expense.md）:
//   expense.summary              → getExpenseSummary（read）
//   expense.listUpcomingPayments → listUpcomingPayments（read, sensitive: includeBank=true で振込先を含む）
import { prisma } from '@/lib/prisma'
import { calendarEvents, contractAlerts, forecastByPayMonth, scheduleActionItems, type CalendarEvent } from './aggregate'
import { addDays, addMonthsToYm, firstOfMonth, fromDbDate, todayJst, toDbDate, ymOf, type Ymd } from './dates'
import { monthlyEquivalent } from './plan'
import { toRowLike } from './sync'

/** ダッシュボード・ホームのカード「今月の支出」・expense.summary */
export async function getExpenseSummary(organizationId: string, today: Ymd = todayJst()) {
  const ym = ymOf(today)
  const to = addMonthsToYm(ym, 11)
  const lo = toDbDate(addDays(today, -90))
  const hi = toDbDate(firstOfMonth(addMonthsToYm(to, 1)))
  const [rows, contracts] = await Promise.all([
    prisma.expenseSchedule.findMany({ where: { organizationId, OR: [{ plannedPayDate: { gte: lo, lt: hi } }, { paidOn: { gte: lo, lt: hi } }] } }),
    prisma.expenseContract.findMany({ where: { organizationId }, select: { id: true, title: true, endDate: true, autoRenew: true, renewalNoticeDays: true, status: true, category: true, frequencyMonths: true } }),
  ])
  const like = rows.map(toRowLike)
  const cashDate = (r: (typeof like)[number]) => (r.status === 'paid' && r.paidOn ? r.paidOn : r.plannedPayDate)
  const cashAmount = (r: (typeof like)[number]) => (r.status === 'paid' && r.paidAmount != null ? r.paidAmount : r.netPayAmount)
  const thisMonth = like.filter((r) => r.status !== 'skipped' && ymOf(cashDate(r)) === ym)
  const nextMonthYm = addMonthsToYm(ym, 1)
  const nextMonth = like.filter((r) => r.status !== 'skipped' && ymOf(cashDate(r)) === nextMonthYm)

  // 固定費（月額換算）: 有効な契約の、今月以降で最初の予定額 ÷ 周期
  const nextByContract = new Map<string, number>()
  for (const r of [...like].sort((a, b) => a.period.localeCompare(b.period))) {
    if (r.contractId && r.period >= `${ym}-01` && !nextByContract.has(r.contractId)) nextByContract.set(r.contractId, r.amountExclTax)
  }
  let fixedMonthly = 0
  let saasMonthly = 0
  let saasCount = 0
  for (const c of contracts) {
    if (c.status !== 'active' || c.frequencyMonths <= 0) continue
    const m = monthlyEquivalent(nextByContract.get(c.id) ?? 0, c.frequencyMonths)
    fixedMonthly += m
    if (c.category === 'saas') {
      saasMonthly += m
      saasCount++
    }
  }
  const sum = (xs: typeof like) => xs.reduce((s, r) => s + cashAmount(r), 0)

  return {
    month: ym,
    kpi: {
      thisMonthOut: sum(thisMonth),
      thisMonthCount: thisMonth.length,
      paid: sum(thisMonth.filter((r) => r.status === 'paid')),
      paidCount: thisMonth.filter((r) => r.status === 'paid').length,
      nextMonthOut: sum(nextMonth),
      fixedMonthly,
      saasMonthly,
      saasCount,
    },
    actionItems: scheduleActionItems(like, today),
    contractAlerts: contractAlerts(contracts.map((c) => ({ ...c, endDate: c.endDate ? fromDbDate(c.endDate) : null })), today),
    cash: forecastByPayMonth(like, ym, to),
    contractCount: contracts.filter((c) => c.status === 'active').length,
    /** ホームでカードを出すかどうか（未使用の組織には空のカードを出さない。§4） */
    inUse: contracts.length > 0 || rows.length > 0,
  }
}

export type UpcomingPayment = {
  scheduleId: string
  date: Ymd
  title: string
  category: string
  kind: string
  status: string
  amount: number
  withholdingAmount: number
  vendorName: string | null
  /** includeBank=true のときだけ入る（sensitive） */
  bank: { bankName: string | null; bankBranch: string | null; bankAccountType: string | null; bankAccountNo: string | null; bankAccountHolder: string | null } | null
}

/** 今日から days 日先までの未払いの支払（支払日超過を含む）。expense.listUpcomingPayments */
export async function listUpcomingPayments(
  organizationId: string,
  opts: { days?: number; includeBank?: boolean; today?: Ymd } = {}
): Promise<UpcomingPayment[]> {
  const today = opts.today ?? todayJst()
  const days = Math.min(Math.max(opts.days ?? 30, 1), 120)
  const rows = await prisma.expenseSchedule.findMany({
    where: { organizationId, status: { notIn: ['paid', 'skipped'] }, plannedPayDate: { gte: toDbDate(addDays(today, -60)), lte: toDbDate(addDays(today, days)) } },
    include: { contract: { include: { vendor: true } } },
    orderBy: [{ plannedPayDate: 'asc' }, { title: 'asc' }],
  })
  return rows.map((r) => {
    const v = r.contract?.vendor
    return {
      scheduleId: r.id,
      date: fromDbDate(r.plannedPayDate),
      title: r.title,
      category: r.kind === 'withholding_tax' ? 'withholding_tax' : r.category,
      kind: r.kind,
      status: r.status,
      amount: r.netPayAmount,
      withholdingAmount: r.withholdingAmount,
      vendorName: v?.name ?? null,
      bank: opts.includeBank && v
        ? { bankName: v.bankName, bankBranch: v.bankBranch, bankAccountType: v.bankAccountType, bankAccountNo: v.bankAccountNo, bankAccountHolder: v.bankAccountHolder }
        : null,
    }
  })
}

/** カレンダー（仮）: 支払日・源泉税の納付日・契約の更新日・終了日（ADDON-SERVICES §4） */
export async function listCalendarEvents(organizationId: string, from: Ymd, to: Ymd): Promise<CalendarEvent[]> {
  const [rows, contracts] = await Promise.all([
    prisma.expenseSchedule.findMany({
      where: { organizationId, OR: [{ plannedPayDate: { gte: toDbDate(from), lte: toDbDate(to) } }, { paidOn: { gte: toDbDate(from), lte: toDbDate(to) } }] },
    }),
    prisma.expenseContract.findMany({ where: { organizationId, status: 'active', endDate: { gte: toDbDate(from), lte: toDbDate(to) } }, select: { id: true, title: true, endDate: true, autoRenew: true, status: true } }),
  ])
  return calendarEvents(rows.map(toRowLike), contracts.map((c) => ({ ...c, endDate: c.endDate ? fromDbDate(c.endDate) : null })), from, to)
}
