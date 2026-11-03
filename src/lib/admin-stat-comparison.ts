export type AdminComparisonStatus = 'comparable' | 'no-baseline' | 'not-measured'

export interface AdminStatComparison {
  percent: number | null
  status: AdminComparisonStatus
}

/** 当月累計と前月全体の比較。前月0件や未集計を増減率0/100%へ置き換えない。 */
export function compareAdminMonthlyCounts(current: number | null, previous: number | null): AdminStatComparison {
  if (current === null || previous === null) return { percent: null, status: 'not-measured' }
  if (![current, previous].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('Invalid admin comparison counts')
  }
  if (previous === 0) return { percent: null, status: 'no-baseline' }
  const percent = Number((((current - previous) / previous) * 100).toFixed(1))
  return { percent: Object.is(percent, -0) ? 0 : percent, status: 'comparable' }
}

/** 比較不能を百分率や増減アイコンで示さない。 */
export function adminComparisonLabel(percent: number | null, status: AdminComparisonStatus): string {
  if (status === 'not-measured') return '未集計'
  if (status === 'no-baseline') return '比較不可（前月0件）'
  if (percent === null || !Number.isFinite(percent)) return '比較不可'
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
}
