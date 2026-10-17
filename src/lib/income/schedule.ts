// ============================================
// ドヤ収入管理: 契約 → 月次の売上予定（IncomeRevenueSchedule）
// ============================================
// 純粋関数。DB への書き込みは src/lib/income/schedule-sync.ts が行う。
// ⚠️ 請求漏れ検知の正本はここで作る予定。計算を変えたら schedule.test.ts も直す。
import { addDays, addMonthsYm, daysInMonth, diffDays, endOfMonth, formatYmd, parseYmd, startOfMonth, type Ymd } from './dates'

export const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly'] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]
export const ISSUE_TIMINGS = ['advance', 'arrears'] as const
export type IssueTiming = (typeof ISSUE_TIMINGS)[number]
export const PRORATES = ['none', 'daily'] as const
export type Prorate = (typeof PRORATES)[number]
export const CONTRACT_TYPES = ['recurring', 'one_time'] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

export const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, yearly: 12 }

export type ScheduleInput = {
  type: ContractType
  startDate: Ymd
  /** null = 期間の定めなし（horizon まで作る） */
  endDate: Ymd | null
  autoRenew: boolean
  billingCycle: BillingCycle
  issueTiming: IssueTiming
  prorate: Prorate
  /** 1 回の請求額（税抜・円） */
  amountExclTax: number
}

export type ScheduleRow = {
  /** 計上月の月初日 */
  period: Ymd
  plannedIssueDate: Ymd
  amountExclTax: number
}

/** cron と契約保存時に作る範囲（今日から何か月先まで） */
export const SCHEDULE_HORIZON_MONTHS = 12

/**
 * 契約から売上予定を作る。
 * - recurring: 開始月から billingCycle ごとに 1 行。終了日（自動更新なら horizon）まで
 * - one_time: 開始月に 1 行
 * - 日割り（prorate=daily）は月払いのときだけ。初月と最終月を、契約に含まれる日数で按分（円未満切り捨て）
 * - 請求予定日: 後払い（arrears）は計上期間の最終月の末日、前払い（advance）は計上期間の前月末
 */
export function buildSchedule(input: ScheduleInput, horizonEnd: Ymd): ScheduleRow[] {
  if (!Number.isSafeInteger(input.amountExclTax) || input.amountExclTax < 0) throw new Error('金額は 0 以上の整数（円）で指定してください')
  const start = parseYmd(input.startDate)
  const cycleMonths = input.type === 'one_time' ? 0 : CYCLE_MONTHS[input.billingCycle]
  if (input.type !== 'one_time' && !cycleMonths) throw new Error('請求サイクルが正しくありません')
  if (input.endDate && input.endDate < input.startDate) throw new Error('終了日が開始日より前です')

  const issueDateFor = (periodStart: Ymd, months: number): Ymd => {
    if (input.issueTiming === 'advance') return addDays(periodStart, -1)
    const p = parseYmd(periodStart)
    const last = addMonthsYm(p.y, p.m, Math.max(months, 1) - 1)
    return formatYmd(last.y, last.m, daysInMonth(last.y, last.m))
  }

  if (input.type === 'one_time') {
    const period = startOfMonth(input.startDate)
    return [{ period, plannedIssueDate: issueDateFor(period, 1), amountExclTax: input.amountExclTax }]
  }

  // 自動更新・期間の定めなしは horizon まで。終了日ありなら早い方まで
  const until = input.endDate && !input.autoRenew ? (input.endDate < horizonEnd ? input.endDate : horizonEnd) : horizonEnd
  const rows: ScheduleRow[] = []
  for (let i = 0; i < 600; i++) {
    const ym = addMonthsYm(start.y, start.m, i * cycleMonths)
    const period = formatYmd(ym.y, ym.m, 1)
    if (period > until) break
    let amount = input.amountExclTax
    if (input.prorate === 'daily' && input.billingCycle === 'monthly') {
      const monthEnd = endOfMonth(period)
      const from = i === 0 ? input.startDate : period
      const to = input.endDate && !input.autoRenew && input.endDate < monthEnd ? input.endDate : monthEnd
      const activeDays = diffDays(from, to) + 1
      const total = daysInMonth(ym.y, ym.m)
      if (activeDays < total) amount = Math.floor((input.amountExclTax * activeDays) / total)
    }
    rows.push({ period, plannedIssueDate: issueDateFor(period, cycleMonths), amountExclTax: amount })
  }
  return rows
}
