import { calculateDailyAttendance } from './attendance'
import { openShiftStart } from './shift-records'
import type { KintaiClockRecord } from './clock-response'

/** Display all completed intervals plus the current interval, excluding gaps between shifts. */
export function calculateClockDisplayMinutes(records: readonly KintaiClockRecord[], now: Date) {
  // The authenticated API already orders equal timestamps by creation and ID. Preserve that
  // supplied order when the shared calculator applies its own stable ordering.
  const normalized = records.map((record, index) => ({
    id: record.id, type: record.type, timestamp: new Date(record.timestamp), createdAt: new Date(index),
  }))
  const latest = normalized.reduce((time, record) => Math.max(time, record.timestamp.getTime()), 0)
  const current = Number.isFinite(now.getTime()) ? Math.max(now.getTime(), latest) : latest
  const input = openShiftStart(normalized)
    ? [...normalized, { id: '~display-only-close', type: 'clock_out' as const,
        timestamp: new Date(current), createdAt: new Date(normalized.length) }]
    : normalized
  // The virtual close is local arithmetic only: it never becomes a saved clock record.
  const { workMinutes, breakMinutes } = calculateDailyAttendance(input, null, new Date(0))
  return { workMinutes, breakMinutes }
}
