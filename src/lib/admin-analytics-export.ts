import type { AdminAnalyticsPeriod } from './admin-analytics-period'

export interface AdminAnalyticsPeriodExport {
  period: AdminAnalyticsPeriod
  label: string
  since: string
  until: string
  previousSince: string
  previousUntil: string
  updatedAt: string
  timeZone: 'Asia/Tokyo'
  metrics: { id: string; serviceName: string; label: string; unit: string; value: number | null; previousValue: number | null }[]
  chart: { metricId: string; buckets: { since: string; until: string; label: string; partial: boolean; value: number }[] }
}

const cell = (value: string | number) => {
  const text = typeof value === 'number' ? String(value) : (/^[\s]*[=+\-@]/.test(value) ? `'${value}` : value)
  return `"${text.replace(/"/g, '""')}"`
}

/** 選択された期間の同一スナップショットを出力。異なる単位の指標を合計しない。 */
export function adminAnalyticsPeriodCsv(data: AdminAnalyticsPeriodExport): string {
  const rows: (string | number)[][] = [
    ['項目', '指標ID', '対象', '値', '単位・範囲', '開始日時（含む）', '終了日時（含まない）'],
    ['選択期間', '', '', data.label, data.timeZone, data.since, data.until],
    ['比較期間', '', '', '直前の同じ長さ', data.timeZone, data.previousSince, data.previousUntil],
    ['取得基準日時', '', '', data.updatedAt, '選択期間の画面と同じスナップショット', '', ''],
  ]
  for (const metric of data.metrics) {
    rows.push(['選択期間の実績', metric.id, `${metric.serviceName} / ${metric.label}`, metric.value ?? '未集計', metric.unit, data.since, data.until])
    rows.push(['比較期間の実績', metric.id, `${metric.serviceName} / ${metric.label}`, metric.previousValue ?? '未集計', metric.unit, data.previousSince, data.previousUntil])
  }
  const metric = data.metrics.find(value => value.id === data.chart.metricId)
  if (!metric) throw new Error('Unknown analytics chart metric')
  for (const bucket of data.chart.buckets) {
    rows.push(['推移', metric.id, bucket.label, bucket.value, `${metric.unit}${bucket.partial ? '（端の一部期間）' : ''}`, bucket.since, bucket.until])
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
