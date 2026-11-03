export type AdminAnalyticsPeriod = 'week' | 'month' | 'year'

const DAY = 86_400_000
const JST = 9 * 3_600_000
const pad = (value: number) => String(value).padStart(2, '0')

export function parseAdminAnalyticsPeriod(value: string | null): AdminAnalyticsPeriod {
  if (value === null) return 'week'
  if (value === 'week' || value === 'month' || value === 'year') return value
  throw new Error('Invalid analytics period')
}

/** 過去7日・30日は経過時間、過去1年は日本時間の前年同日（閏日は末日へ補正）。 */
export function adminAnalyticsPeriodRange(period: AdminAnalyticsPeriod, at = new Date()) {
  if (!['week', 'month', 'year'].includes(period) || !Number.isFinite(at.getTime())) {
    throw new Error('Invalid analytics period')
  }
  const until = new Date(at.getTime())
  let start = until.getTime() - (period === 'week' ? 7 : 30) * DAY
  if (period === 'year') {
    const shifted = new Date(until.getTime() + JST)
    const previous = new Date(shifted.getTime())
    previous.setUTCDate(1)
    previous.setUTCFullYear(shifted.getUTCFullYear() - 1)
    const monthEnd = new Date(previous.getTime())
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0)
    previous.setUTCDate(Math.min(shifted.getUTCDate(), monthEnd.getUTCDate()))
    start = previous.getTime() - JST
  }
  const since = new Date(start)
  const previousSince = new Date(start - (until.getTime() - start))
  const buckets: { since: string; until: string; label: string; partial: boolean }[] = []
  let cursor = start
  while (cursor < until.getTime()) {
    const shifted = new Date(cursor + JST)
    const floor = new Date(shifted.getTime())
    floor.setUTCHours(0, 0, 0, 0)
    if (period === 'year') floor.setUTCDate(1)
    const next = new Date(floor.getTime())
    if (period === 'year') next.setUTCMonth(next.getUTCMonth() + 1)
    else next.setUTCDate(next.getUTCDate() + 1)
    const end = Math.min(next.getTime() - JST, until.getTime())
    const label = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}${period === 'year' ? '' : `-${pad(shifted.getUTCDate())}`}`
    buckets.push({ since: new Date(cursor).toISOString(), until: new Date(end).toISOString(), label,
      partial: cursor !== floor.getTime() - JST || end !== next.getTime() - JST })
    cursor = end
  }
  return { period, label: period === 'week' ? '過去7日' : period === 'month' ? '過去30日' : '過去1年',
    timeZone: 'Asia/Tokyo' as const, since: since.toISOString(), until: until.toISOString(),
    previousSince: previousSince.toISOString(), previousUntil: since.toISOString(), buckets }
}
