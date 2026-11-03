import { prisma } from './prisma'
import { getRunningServices } from './services'
import { adminAnalyticsPeriodRange, type AdminAnalyticsPeriod } from './admin-analytics-period'
import type { AdminAnalyticsPeriodExport } from './admin-analytics-export'

type Group = { serviceId: string; window: string; bucket: string; count: string }
type Counts = { current: string; previous: string }

function count(value: string): number {
  const number = Number(value)
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number)) throw new Error('Invalid analytics count')
  return number
}

/** Counts stored rows, including USAGE. It never infers outputs or unrecorded activity. */
export async function readAdminAnalyticsPeriod(period: AdminAnalyticsPeriod, at = new Date()): Promise<AdminAnalyticsPeriodExport> {
  const range = adminAnalyticsPeriodRange(period, at)
  const since = new Date(range.since), until = new Date(range.until), previous = new Date(range.previousSince)
  const unit = period === 'year' ? 'month' : 'day'
  const format = period === 'year' ? 'YYYY-MM' : 'YYYY-MM-DD'
  // All aggregates share one DB snapshot. No customer names, inputs or outputs are selected.
  const [groups, registrations, actors] = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    await tx.$executeRaw`SET LOCAL statement_timeout = '15000ms'`
    const groups = await tx.$queryRaw<Group[]>`
      SELECT "serviceId", CASE WHEN "createdAt" >= ${since} THEN 'current' ELSE 'previous' END AS "window",
        to_char(date_trunc(${unit}::text, "createdAt" + interval '9 hours'), ${format}::text) AS bucket,
        count(*)::text AS count
      FROM "Generation" WHERE "createdAt" >= ${previous} AND "createdAt" < ${until}
      GROUP BY 1, 2, 3`
    const registrations = await tx.$queryRaw<Counts[]>`
      SELECT count(*) FILTER (WHERE "createdAt" >= ${since})::text AS current,
        count(*) FILTER (WHERE "createdAt" < ${since})::text AS previous
      FROM "User" WHERE "createdAt" >= ${previous} AND "createdAt" < ${until}`
    const actors = await tx.$queryRaw<Counts[]>`
      SELECT count(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${since})::text AS current,
        count(DISTINCT "userId") FILTER (WHERE "createdAt" < ${since})::text AS previous
      FROM "Generation" WHERE "createdAt" >= ${previous} AND "createdAt" < ${until}`
    return [groups, registrations, actors] as const
  }, { isolationLevel: 'RepeatableRead', maxWait: 5_000, timeout: 20_000 })

  const services = getRunningServices()
  const byService = new Map(services.map(service => [service.id, { current: 0, previous: 0 }]))
  const other = { current: 0, previous: 0 }, totals = { current: 0, previous: 0 }
  const buckets = range.buckets.map(bucket => ({ ...bucket, value: 0 }))
  const byLabel = new Map(buckets.map(bucket => [bucket.label, bucket]))
  for (const group of groups) {
    if (group.window !== 'current' && group.window !== 'previous') throw new Error('Invalid analytics window')
    const value = count(group.count), target = byService.get(group.serviceId) ?? other
    target[group.window] += value
    totals[group.window] += value
    if (group.window === 'current') {
      const bucket = byLabel.get(group.bucket)
      if (!bucket) throw new Error('Invalid analytics bucket')
      bucket.value += value
    }
  }
  if (registrations.length !== 1 || actors.length !== 1) throw new Error('Invalid analytics aggregate')
  const metric = (id: string, serviceName: string, label: string, unit: string, values: { current: number; previous: number }) => ({
    id, serviceName, label, unit, value: values.current, previousValue: values.previous,
  })
  const metrics = [
    metric('records', '全体', '保存された利用記録', '件', totals),
    metric('registrations', '全体', '新規登録人数', '人', { current: count(registrations[0].current), previous: count(registrations[0].previous) }),
    metric('recorded-users', '全体', '利用記録のある登録ユーザー', '人', { current: count(actors[0].current), previous: count(actors[0].previous) }),
    ...services.map(service => metric(`records:${service.id}`, service.name, '保存された利用記録', '件', byService.get(service.id)!)),
    metric('records:other', 'その他（提供終了・未分類）', '保存された利用記録', '件', other),
  ]
  if (metrics.some(item => !Number.isSafeInteger(item.value) || !Number.isSafeInteger(item.previousValue))) throw new Error('Analytics count overflow')
  return { ...range, updatedAt: range.until, metrics, chart: { metricId: 'records', buckets } }
}
