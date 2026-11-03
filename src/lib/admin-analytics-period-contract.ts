import { adminAnalyticsPeriodRange, type AdminAnalyticsPeriod } from './admin-analytics-period'
import type { AdminAnalyticsPeriodExport } from './admin-analytics-export'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200

/** Validate the requested period, calendar bounds, distinct counts and chart/service reconciliation. */
export function isAdminAnalyticsPeriodData(value: unknown, period: AdminAnalyticsPeriod): value is AdminAnalyticsPeriodExport {
  if (!object(value) || value.period !== period || typeof value.updatedAt !== 'string') return false
  let expected: ReturnType<typeof adminAnalyticsPeriodRange>
  try { expected = adminAnalyticsPeriodRange(period, new Date(value.updatedAt)) } catch { return false }
  for (const key of ['label', 'since', 'until', 'previousSince', 'previousUntil', 'timeZone'] as const) {
    if (value[key] !== expected[key]) return false
  }
  if (value.updatedAt !== expected.until || !Array.isArray(value.metrics) || value.metrics.length < 4 || value.metrics.length > 500) return false
  const ids = new Set<string>()
  for (const metric of value.metrics) {
    if (!object(metric) || !text(metric.id) || ids.has(metric.id) || !text(metric.label) || !text(metric.serviceName) || !count(metric.value) || !count(metric.previousValue)) return false
    if (!['records', 'registrations', 'recorded-users'].includes(metric.id) && !/^records:[a-z0-9-]+$/.test(metric.id)) return false
    if (metric.unit !== (metric.id.startsWith('records') ? '件' : '人')) return false
    ids.add(metric.id)
  }
  for (const id of ['records', 'registrations', 'recorded-users', 'records:other']) if (!ids.has(id)) return false
  const metrics = value.metrics as AdminAnalyticsPeriodExport['metrics']
  const total = metrics.find(metric => metric.id === 'records')!
  const users = metrics.find(metric => metric.id === 'recorded-users')!
  if (users.value! > total.value! || users.previousValue! > total.previousValue!) return false
  for (const key of ['value', 'previousValue'] as const) {
    const sum = metrics.filter(metric => metric.id.startsWith('records:')).reduce((sum, metric) => sum + metric[key]!, 0)
    if (!Number.isSafeInteger(sum) || sum !== total[key]) return false
  }
  if (!object(value.chart) || value.chart.metricId !== 'records' || !Array.isArray(value.chart.buckets) || value.chart.buckets.length !== expected.buckets.length) return false
  let sum = 0
  for (let i = 0; i < expected.buckets.length; i++) {
    const bucket: unknown = value.chart.buckets[i]
    if (!object(bucket) || !count(bucket.value)) return false
    for (const key of ['since', 'until', 'label', 'partial'] as const) if (bucket[key] !== expected.buckets[i][key]) return false
    sum += bucket.value
  }
  return Number.isSafeInteger(sum) && sum === total.value
}
