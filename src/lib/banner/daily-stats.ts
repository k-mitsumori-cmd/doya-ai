const DAY_MS = 86_400_000
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

export type BannerDailyStat = { date: string; count: number }

/** Seven calendar days in Japan time, including days with no generated images. */
export function bannerDailyStats(history: { createdAt: string; bannerCount: number }[], now = new Date()): BannerDailyStat[] {
  const today = new Date(now.getTime() + JST_OFFSET_MS)
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const counts = new Map<string, number>()
  for (const item of history) {
    const timestamp = new Date(item.createdAt).getTime()
    if (!Number.isFinite(timestamp) || !Number.isFinite(item.bannerCount) || item.bannerCount < 0) continue
    const key = new Date(timestamp + JST_OFFSET_MS).toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) || 0) + item.bannerCount)
  }
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart - (6 - index) * DAY_MS)
    const key = day.toISOString().slice(0, 10)
    return { date: `${day.getUTCMonth() + 1}/${day.getUTCDate()}`, count: counts.get(key) || 0 }
  })
}
