type ClockRecord = { type: string; timestamp: Date; createdAt?: Date | null; id?: string }

export function orderedClockRecords<T extends ClockRecord>(records: T[]): T[] {
  return [...records].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
    || +(a.createdAt ? new Date(a.createdAt) : 0) - +(b.createdAt ? new Date(b.createdAt) : 0)
    || (String(a.id || '') < String(b.id || '') ? -1 : String(a.id || '') > String(b.id || '') ? 1 : 0))
}

/** The most recent clock_in that has not yet been closed by clock_out. */
export function openShiftStart<T extends ClockRecord>(records: T[]): T | null {
  let open: T | null = null
  for (const record of orderedClockRecords(records)) {
    if (record.type === 'clock_in' && !open) open = record
    else if (record.type === 'clock_out' && open) open = null
  }
  return open
}

/** Include only shifts that began on the requested JST workday, including their next-day events. */
export function recordsForWorkday<T extends ClockRecord>(records: T[], dayStart: Date, dayEnd: Date): T[] {
  const selected: T[] = []
  let open: T | null = null
  let included = false
  for (const record of orderedClockRecords(records)) {
    if (record.type === 'clock_in' && !open) {
      open = record
      included = +new Date(record.timestamp) >= +dayStart && +new Date(record.timestamp) < +dayEnd
      if (included) selected.push(record)
    } else if (open) {
      if (included) selected.push(record)
      if (record.type === 'clock_out') { open = null; included = false }
    }
  }
  return selected
}

/** Carry yesterday's still-open shift into today's clock screen, without yesterday's closed shifts. */
export function recordsWithCarryover<T extends ClockRecord>(records: T[], dayStart: Date): T[] {
  const ordered = orderedClockRecords(records)
  let openIndex: number | null = null
  for (let i = 0; i < ordered.length && +new Date(ordered[i].timestamp) < +dayStart; i++) {
    if (ordered[i].type === 'clock_in' && openIndex === null) openIndex = i
    else if (ordered[i].type === 'clock_out') openIndex = null
  }
  const today = ordered.filter(record => +new Date(record.timestamp) >= +dayStart)
  if (openIndex === null) return today
  const carried = ordered.slice(openIndex)
  const closed = carried.findIndex(record => record.type === 'clock_out')
  if (closed >= 0 && carried.slice(closed + 1).some(record => record.type === 'clock_in')) return today
  return carried
}

export function jstWorkdayDate(timestamp: Date): Date {
  const jst = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()))
}
