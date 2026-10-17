// ============================================
// ドヤ収入管理: 集計（読み取り専用。ADDON-SERVICES R-4）
// ダッシュボード API・ホーム・エージェント道具（income.summary）が同じ関数を呼ぶ。LLM は使わない。
// ============================================
import { prisma } from '@/lib/prisma'
/** 読み取りに要る文脈だけ（エージェント道具からも作れるように IncomeContext の一部） */
export type ReadCtx = { userId: string; organizationId: string }
import { addDays, addMonthsYm, diffDays, formatYmd, fromDbDate, parseYmd, toDbDate, todayJst, type Ymd } from './dates'
import { monthlyExpenses } from './expense-source'
import { paymentState, periodLabel } from './invoices'

export type ActionItem = {
  kind: 'leak' | 'overdue' | 'draft_contract' | 'renewal' | 'contract_end'
  title: string
  detail: string
  amount: number | null
  href: string
  dueOn: Ymd
}

function monthRange(month: string) {
  const { y, m } = parseYmd(`${month}-01`)
  const next = addMonthsYm(y, m, 1)
  return { gte: toDbDate(formatYmd(y, m, 1)), lt: toDbDate(formatYmd(next.y, next.m, 1)) }
}

export async function buildSummary(ctx: ReadCtx, month: string, today: Ymd = todayJst()) {
  const orgId = ctx.organizationId
  const range = monthRange(month)
  const org = await prisma.incomeOrganization.findFirst({ where: { id: orgId }, select: { promaneWorkspaceId: true, expenseSourceId: true, expenseOrganizationId: true } })

  const [monthSchedules, receivedAgg, openInvoices, leaks, contracts] = await Promise.all([
    prisma.incomeRevenueSchedule.findMany({ where: { organizationId: orgId, period: range, status: { not: 'skipped' } }, select: { amountExclTax: true, status: true } }),
    prisma.incomePayment.aggregate({ where: { organizationId: orgId, receivedOn: range }, _sum: { amount: true } }),
    prisma.incomeInvoice.findMany({
      where: { organizationId: orgId, status: { in: ['confirmed', 'sent'] } },
      select: { id: true, invoiceNo: true, status: true, totalInclTax: true, paidAmount: true, dueDate: true, client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.incomeRevenueSchedule.findMany({
      where: { organizationId: orgId, status: 'planned', plannedIssueDate: { lte: toDbDate(today) } },
      select: { id: true, period: true, plannedIssueDate: true, amountExclTax: true, client: { select: { name: true } }, contract: { select: { title: true } } },
      orderBy: { plannedIssueDate: 'asc' },
      take: 50,
    }),
    prisma.incomeContract.findMany({
      where: { organizationId: orgId, OR: [{ status: 'draft' }, { status: 'active', endDate: { not: null, lte: toDbDate(addDays(today, 90)) } }] },
      select: { id: true, title: true, status: true, endDate: true, autoRenew: true, renewalNoticeDays: true, amountExclTax: true, client: { select: { name: true } } },
    }),
  ])

  const scheduled = monthSchedules.reduce((a, s) => a + s.amountExclTax, 0)
  const invoiced = monthSchedules.filter((s) => s.status === 'invoiced').reduce((a, s) => a + s.amountExclTax, 0)
  const unpaid = openInvoices.map((i) => ({ ...i, state: paymentState(i, today) })).filter((i) => i.state.remaining > 0)

  const actions: ActionItem[] = []
  for (const l of leaks) {
    actions.push({
      kind: 'leak',
      title: `請求漏れ ${l.client.name}`,
      detail: `${l.contract.title}（${periodLabel(fromDbDate(l.period))}）請求予定日 ${fromDbDate(l.plannedIssueDate)} を経過`,
      amount: l.amountExclTax,
      href: `/income/revenue?month=${fromDbDate(l.period).slice(0, 7)}`,
      dueOn: fromDbDate(l.plannedIssueDate),
    })
  }
  for (const i of unpaid.filter((u) => u.state.overdue)) {
    const due = fromDbDate(i.dueDate)
    actions.push({
      kind: 'overdue',
      title: `入金遅延 ${i.client.name}`,
      detail: `${i.invoiceNo} 支払期日 ${due}（${diffDays(due, today)}日経過）`,
      amount: i.state.remaining,
      href: `/income/invoices/${i.id}`,
      dueOn: due,
    })
  }
  for (const c of contracts) {
    if (c.status === 'draft') {
      actions.push({ kind: 'draft_contract', title: `未確定の契約 ${c.client.name}`, detail: `${c.title} が下書きのままです`, amount: c.amountExclTax, href: `/income/contracts/${c.id}`, dueOn: today })
      continue
    }
    const end = fromDbDate(c.endDate!)
    if (c.autoRenew && c.renewalNoticeDays != null) {
      const notice = addDays(end, -c.renewalNoticeDays)
      const left = diffDays(today, notice)
      if (left >= 0 && left <= 30) actions.push({ kind: 'renewal', title: `更新期限 ${c.client.name}`, detail: `${c.title} の解約予告期限まで ${left} 日（${notice}）`, amount: null, href: `/income/contracts/${c.id}`, dueOn: notice })
    } else if (!c.autoRenew) {
      const left = diffDays(today, end)
      if (left >= 0 && left <= 60) actions.push({ kind: 'contract_end', title: `契約終了 ${c.client.name}`, detail: `${c.title} が ${end} に終了します（${left} 日後）`, amount: null, href: `/income/contracts/${c.id}`, dueOn: end })
    }
  }
  const order: Record<ActionItem['kind'], number> = { leak: 0, overdue: 1, draft_contract: 2, renewal: 3, contract_end: 4 }
  actions.sort((a, b) => order[a.kind] - order[b.kind] || a.dueOn.localeCompare(b.dueOn))

  // 12 か月の推移（対象月の 11 か月前から）。売上予定は税抜、入金は税込の受取額
  const { y, m } = parseYmd(`${month}-01`)
  const first = addMonthsYm(y, m, -11)
  const fromMonth = formatYmd(first.y, first.m, 1).slice(0, 7)
  const trendRange = { gte: toDbDate(`${fromMonth}-01`), lt: range.lt }
  const [trendSchedules, trendPayments, expense] = await Promise.all([
    prisma.incomeRevenueSchedule.groupBy({ by: ['period'], where: { organizationId: orgId, period: trendRange, status: { not: 'skipped' } }, _sum: { amountExclTax: true } }),
    prisma.incomePayment.findMany({ where: { organizationId: orgId, receivedOn: trendRange }, select: { receivedOn: true, amount: true } }),
    monthlyExpenses(ctx.userId, { promaneWorkspaceId: org?.promaneWorkspaceId ?? null, expenseSourceId: org?.expenseSourceId ?? null, expenseOrganizationId: org?.expenseOrganizationId ?? null }, fromMonth, month),
  ])
  const trend = Array.from({ length: 12 }, (_, i) => {
    const ym = addMonthsYm(first.y, first.m, i)
    const key = formatYmd(ym.y, ym.m, 1).slice(0, 7)
    const revenue = trendSchedules.filter((s) => fromDbDate(s.period).startsWith(key)).reduce((a, s) => a + (s._sum.amountExclTax ?? 0), 0)
    const received = trendPayments.filter((p) => fromDbDate(p.receivedOn).startsWith(key)).reduce((a, p) => a + p.amount, 0)
    const exp = expense.connected ? expense.months.find((e) => e.month === key)?.total ?? 0 : null
    return { month: key, revenue, received, expense: exp, profit: exp === null ? null : revenue - exp }
  })

  const current = trend[trend.length - 1]
  return {
    month,
    today,
    kpi: {
      scheduled,
      invoiced,
      received: receivedAgg._sum.amount ?? 0,
      unpaid: unpaid.reduce((a, i) => a + i.state.remaining, 0),
      overdueCount: unpaid.filter((i) => i.state.overdue).length,
      scheduleCount: monthSchedules.length,
      invoicedCount: monthSchedules.filter((s) => s.status === 'invoiced').length,
      expense: current.expense,
      profit: current.profit,
    },
    expense: expense.connected ? { connected: true as const, workspaceName: expense.workspaceName, sourceLabel: expense.sourceLabel, note: expense.note } : { connected: false as const, reason: expense.reason },
    actions,
    trend,
  }
}

/**
 * ホーム（経営ホーム §4）のカード用。ダッシュボードの集計から必要な分だけ返す。
 * 使っていない組織（契約 0 件）は null（空のカードを出さない）。
 */
export async function homeIncomeSummary(ctx: ReadCtx, month: string, today: Ymd = todayJst()) {
  const used = await prisma.incomeContract.count({ where: { organizationId: ctx.organizationId } })
  if (used === 0) return null
  const s = await buildSummary(ctx, month, today)
  return {
    month: s.month,
    revenue: { scheduled: s.kpi.scheduled, invoiced: s.kpi.invoiced, received: s.kpi.received },
    billing: {
      leaks: s.actions.filter((a) => a.kind === 'leak').length,
      overdue: s.kpi.overdueCount,
      unpaid: s.kpi.unpaid,
    },
    expense: s.kpi.expense,
    profit: s.kpi.profit,
    /** 今日やること（請求漏れ・入金遅延を先頭に最大 5 件） */
    todo: s.actions.slice(0, 5),
    href: '/income',
  }
}
