// ============================================
// ドヤ支出管理: 集計（純粋関数）
// ============================================
// ⚠️ 計上月（period）の集計と、出金日（plannedPayDate / paidOn）の集計を混ぜない（設計書 §4.2-2）
// ⚠️ 源泉税の行（withholding_tax）は計上月の集計に入れない。報酬の額面にすでに含まれるため（§8.2）
import { CONFIRMED_STATUSES, LABOR_CATEGORIES, AMOUNT_DIFF_RATIO, BILL_MISSING_DAYS } from './constants'
import { addDays, diffDays, ymOf, type Ym, type Ymd } from './dates'

export type ScheduleRowLike = {
  id: string
  kind: string
  title: string
  category: string
  period: Ymd
  plannedPayDate: Ymd
  plannedAmountExclTax: number
  amountExclTax: number
  taxAmount: number
  withholdingAmount: number
  netPayAmount: number
  status: string
  paidOn: Ymd | null
  paidAmount: number | null
  estimated: boolean
  contractId: string | null
}

/** 収入側 ExpenseSource の MonthlyExpense と同じ形（収入設計書 §8.1 ＋ 本書 §8.1 の追加項目） */
export type MonthlyExpense = {
  month: Ym
  expense: number
  laborCost: number
  total: number
  byCategory: Record<string, number>
  planned: number
  confirmed: number
}

export type CashOutEvent = {
  date: Ymd
  amount: number
  category: string
  label: string
  status: 'planned' | 'paid'
}

export function monthRange(fromYm: Ym, toYm: Ym): Ym[] {
  const out: Ym[] = []
  let m = fromYm
  while (m <= toYm && out.length < 600) {
    out.push(m)
    const [y, mm] = m.split('-').map(Number)
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`
  }
  return out
}

/** 計上月ごとの支出（税抜）。収入側の発生ベースの粗利に使う */
export function monthlyExpenses(rows: ScheduleRowLike[], fromYm: Ym, toYm: Ym): MonthlyExpense[] {
  const map = new Map<Ym, MonthlyExpense>()
  for (const m of monthRange(fromYm, toYm)) map.set(m, { month: m, expense: 0, laborCost: 0, total: 0, byCategory: {}, planned: 0, confirmed: 0 })
  for (const r of rows) {
    if (r.kind === 'withholding_tax' || r.status === 'skipped') continue
    const bucket = map.get(ymOf(r.period))
    if (!bucket) continue
    const v = r.amountExclTax
    if (LABOR_CATEGORIES.has(r.category)) bucket.laborCost += v
    else bucket.expense += v
    bucket.total += v
    bucket.byCategory[r.category] = (bucket.byCategory[r.category] ?? 0) + v
    if (CONFIRMED_STATUSES.has(r.status)) bucket.confirmed += v
    else bucket.planned += v
  }
  return Array.from(map.values())
}

/** 実際に口座から出る日と金額。源泉税の納付も含める。資金繰り（キャッシュベース）に使う */
export function cashOutEvents(rows: ScheduleRowLike[], fromDate: Ymd, toDate: Ymd): CashOutEvent[] {
  const out: CashOutEvent[] = []
  for (const r of rows) {
    if (r.status === 'skipped') continue
    const paid = r.status === 'paid'
    const date = paid && r.paidOn ? r.paidOn : r.plannedPayDate
    if (date < fromDate || date > toDate) continue
    out.push({
      date,
      amount: paid && r.paidAmount != null ? r.paidAmount : r.netPayAmount,
      category: r.kind === 'withholding_tax' ? 'withholding_tax' : r.category,
      label: r.title,
      status: paid ? 'paid' : 'planned',
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
}

export type ForecastCell = { amount: number; estimated: number }
export type ForecastMatrix = {
  months: Ym[]
  categories: string[]
  cells: Record<string, Record<Ym, ForecastCell>>
  totals: Record<Ym, ForecastCell>
}

/** 予測画面: 出金月 × カテゴリ（実際の出金額。源泉税は別カテゴリ） */
export function forecastByPayMonth(rows: ScheduleRowLike[], fromYm: Ym, toYm: Ym): ForecastMatrix {
  const months = monthRange(fromYm, toYm)
  const cells: ForecastMatrix['cells'] = {}
  const totals: ForecastMatrix['totals'] = Object.fromEntries(months.map((m) => [m, { amount: 0, estimated: 0 }]))
  for (const r of rows) {
    if (r.status === 'skipped') continue
    const paid = r.status === 'paid'
    const m = ymOf(paid && r.paidOn ? r.paidOn : r.plannedPayDate)
    if (!totals[m]) continue
    const cat = r.kind === 'withholding_tax' ? 'withholding_tax' : r.category
    const amount = paid && r.paidAmount != null ? r.paidAmount : r.netPayAmount
    const isEstimate = !CONFIRMED_STATUSES.has(r.status) && (r.estimated || r.status === 'planned')
    cells[cat] ??= Object.fromEntries(months.map((mm) => [mm, { amount: 0, estimated: 0 }]))
    cells[cat][m].amount += amount
    totals[m].amount += amount
    if (isEstimate) {
      cells[cat][m].estimated += amount
      totals[m].estimated += amount
    }
  }
  return { months, categories: Object.keys(cells), cells, totals }
}

export type ActionItem = {
  kind: 'bill_missing' | 'overdue' | 'amount_diff' | 'withholding_due'
  scheduleId: string
  title: string
  dueOn: Ymd
  amount: number
  detail: string
}

/** 要対応（保存せず読むときに計算する。設計書 §4.2-4） */
export function scheduleActionItems(rows: ScheduleRowLike[], today: Ymd): ActionItem[] {
  const out: ActionItem[] = []
  for (const r of rows) {
    if (r.status === 'paid' || r.status === 'skipped') continue
    const daysLeft = diffDays(today, r.plannedPayDate)
    if (r.kind === 'withholding_tax') {
      if (daysLeft <= 7) out.push({ kind: daysLeft < 0 ? 'overdue' : 'withholding_due', scheduleId: r.id, title: r.title, dueOn: r.plannedPayDate, amount: r.netPayAmount, detail: daysLeft < 0 ? `納付期限を${-daysLeft}日過ぎています` : `納付期限まで${daysLeft}日` })
      continue
    }
    if (daysLeft < 0) {
      out.push({ kind: 'overdue', scheduleId: r.id, title: r.title, dueOn: r.plannedPayDate, amount: r.netPayAmount, detail: `支払日を${-daysLeft}日過ぎています` })
      continue
    }
    if (r.status === 'planned' && r.kind === 'contract' && addDays(r.plannedPayDate, -BILL_MISSING_DAYS) <= today) {
      out.push({ kind: 'bill_missing', scheduleId: r.id, title: r.title, dueOn: r.plannedPayDate, amount: r.netPayAmount, detail: `請求書が未着です（支払日まで${daysLeft}日）` })
    }
    if (CONFIRMED_STATUSES.has(r.status) && hasAmountDiff(r)) {
      out.push({ kind: 'amount_diff', scheduleId: r.id, title: r.title, dueOn: r.plannedPayDate, amount: r.amountExclTax, detail: `予定 ${r.plannedAmountExclTax.toLocaleString('ja-JP')}円 → 請求 ${r.amountExclTax.toLocaleString('ja-JP')}円（税抜）` })
    }
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}

export function hasAmountDiff(r: Pick<ScheduleRowLike, 'kind' | 'plannedAmountExclTax' | 'amountExclTax'>): boolean {
  if (r.kind !== 'contract' || r.plannedAmountExclTax <= 0) return false
  return Math.abs(r.amountExclTax - r.plannedAmountExclTax) / r.plannedAmountExclTax >= AMOUNT_DIFF_RATIO
}

export type CalendarEvent = {
  date: Ymd
  kind: 'payment' | 'withholding_tax' | 'renewal' | 'contract_end'
  title: string
  /** 出金額（契約の更新・終了は null） */
  amount: number | null
  status: string | null
  targetType: 'schedule' | 'contract'
  targetId: string
}

/** カレンダー用: 支払日・源泉税の納付日・契約の更新日・終了日（ADDON-SERVICES §4 listCalendarEvents） */
export function calendarEvents(
  rows: ScheduleRowLike[],
  contracts: Pick<ContractAlertInput, 'id' | 'title' | 'endDate' | 'autoRenew' | 'status'>[],
  from: Ymd,
  to: Ymd
): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const r of rows) {
    if (r.status === 'skipped') continue
    const date = r.status === 'paid' && r.paidOn ? r.paidOn : r.plannedPayDate
    if (date < from || date > to) continue
    out.push({
      date,
      kind: r.kind === 'withholding_tax' ? 'withholding_tax' : 'payment',
      title: r.title,
      amount: r.status === 'paid' && r.paidAmount != null ? r.paidAmount : r.netPayAmount,
      status: r.status,
      targetType: 'schedule',
      targetId: r.id,
    })
  }
  for (const c of contracts) {
    if (c.status !== 'active' || !c.endDate || c.endDate < from || c.endDate > to) continue
    out.push({ date: c.endDate, kind: c.autoRenew ? 'renewal' : 'contract_end', title: c.title, amount: null, status: null, targetType: 'contract', targetId: c.id })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
}

export type ContractAlertInput ={ id: string; title: string; endDate: Ymd | null; autoRenew: boolean; renewalNoticeDays: number; status: string; category: string }
export type ContractAlert = { kind: 'renewal' | 'contract_end'; contractId: string; title: string; dueOn: Ymd; detail: string }

/** 更新期限・契約終了の通知 */
export function contractAlerts(contracts: ContractAlertInput[], today: Ymd): ContractAlert[] {
  const out: ContractAlert[] = []
  for (const c of contracts) {
    if (c.status !== 'active' || !c.endDate) continue
    const days = diffDays(today, c.endDate)
    if (days < 0) continue
    if (c.autoRenew) {
      if (days <= c.renewalNoticeDays) out.push({ kind: 'renewal', contractId: c.id, title: c.title, dueOn: c.endDate, detail: `${c.endDate} に自動更新されます（あと${days}日）` })
    } else if (days <= 30) {
      out.push({ kind: 'contract_end', contractId: c.id, title: c.title, dueOn: c.endDate, detail: c.category === 'contractor' ? `${c.endDate} に契約が終了します。更新するか決めてください（あと${days}日）` : `${c.endDate} に契約が終了します（あと${days}日）` })
    }
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}
