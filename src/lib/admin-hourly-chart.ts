const HOUR = 3_600_000
const JST = 9 * HOUR
const pad = (value: number) => String(value).padStart(2, '0')

/** Labels are derived from the API snapshot, including the current partial hour, never the client clock. */
export function adminHourlyChartTimes(lastUpdated: string) {
  const at = Date.parse(lastUpdated)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(lastUpdated) || !Number.isFinite(at) || new Date(at).toISOString() !== lastUpdated) throw new Error('Invalid statistics snapshot')
  const currentHour = Math.floor(at / HOUR) * HOUR
  return Array.from({ length: 12 }, (_, index) => {
    const start = currentHour - (11 - index) * HOUR
    const end = Math.min(start + HOUR, at)
    const shifted = new Date(start + JST)
    const date = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
    return { since: new Date(start).toISOString(), until: new Date(end).toISOString(), date,
      label: `${pad(shifted.getUTCHours())}:00`, partial: end !== start + HOUR }
  })
}
