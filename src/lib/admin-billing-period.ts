import { jstMonthRange } from '@/lib/jst'

export type AdminBillingPeriod = 'month' | 'quarter' | 'year'

/** 当月・当四半期・当年。集計の終端は次期間の日本時間0時（終端は含まない）。 */
export function adminBillingPeriodRange(period: AdminBillingPeriod, at = new Date()) {
  if (!['month', 'quarter', 'year'].includes(period) || !Number.isFinite(at.getTime())) {
    throw new Error('Invalid admin billing period')
  }
  const offset = 9 * 3600_000
  const currentMonth = jstMonthRange(at)
  const shifted = new Date(currentMonth.start.getTime() + offset)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth()
  const firstMonth = period === 'year' ? 0 : period === 'quarter' ? Math.floor(month / 3) * 3 : month
  const months = period === 'year' ? 12 : period === 'quarter' ? 3 : 1
  const since = new Date(Date.UTC(year, firstMonth, 1) - offset)
  const until = new Date(Date.UTC(year, firstMonth + months, 1) - offset)
  const label = period === 'year' ? `${year}年` : period === 'quarter' ? `${year}年第${firstMonth / 3 + 1}四半期` : `${year}年${month + 1}月`
  return { period, since, until, label }
}
