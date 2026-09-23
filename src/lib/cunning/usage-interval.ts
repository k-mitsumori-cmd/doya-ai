const JST_MS = 9 * 60 * 60 * 1000
export function cunningMonthStart(at: Date): Date {
  if (!Number.isFinite(at.getTime())) throw new Error('Invalid usage time')
  const jst = new Date(at.getTime() + JST_MS)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_MS)
}
export function splitCunningInterval(start: Date, end: Date): { monthStart: Date; milliseconds: number }[] {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || end.getTime() - start.getTime() > 366 * 86400000) throw new Error('Invalid usage interval')
  const result: { monthStart: Date; milliseconds: number }[] = []
  let cursor = start.getTime()
  while (cursor < end.getTime()) {
    const monthStart = cunningMonthStart(new Date(cursor))
    const jst = new Date(monthStart.getTime() + JST_MS)
    const next = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 1, 1) - JST_MS
    const stop = Math.min(next, end.getTime())
    result.push({ monthStart, milliseconds: stop - cursor })
    cursor = stop
  }
  return result
}
