export function formatMinutesJa(minutes: number): string {
  if (!minutes || minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

export function getClockStatusFromRecords(records: { type: string }[]): 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out' {
  if (records.length === 0) return 'not_clocked_in'
  const last = records[records.length - 1]
  switch (last.type) {
    case 'clock_in': return 'working'
    case 'break_start': return 'on_break'
    case 'break_end': return 'working'
    case 'clock_out': return 'clocked_out'
    default: return 'not_clocked_in'
  }
}
