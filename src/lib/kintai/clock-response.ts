/** JSON contracts used by the clock screen. Never infer a saved clock from HTTP status alone. */
export type KintaiClockType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
export type KintaiClockStatus = 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out'
export type KintaiClockRecord = { id: string; employeeId: string; type: KintaiClockType; timestamp: string }
export type KintaiClockRead = { records: KintaiClockRecord[]; activeShiftRecords: KintaiClockRecord[]; clockStatus: KintaiClockStatus; date: string }
const kinds = ['clock_in', 'clock_out', 'break_start', 'break_end']
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^c[a-z0-9]{24}$/.test(value)
export function isKintaiClockRecord(value: unknown): value is KintaiClockRecord {
  return object(value) && id(value.id) && id(value.employeeId) && typeof value.type === 'string' && kinds.includes(value.type)
    && typeof value.timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value.timestamp) && Number.isFinite(Date.parse(value.timestamp)) && new Date(value.timestamp).toISOString() === value.timestamp
}
export function isKintaiClockAcknowledgement(value: unknown, type: string): value is { record: KintaiClockRecord } {
  return object(value) && value.error === undefined && value.code === undefined && isKintaiClockRecord(value.record) && value.record.type === type
}
export function parseKintaiClockRead(value: unknown, date: string): KintaiClockRead {
  if (!object(value) || value.error !== undefined || value.code !== undefined || value.date !== date
    || !Array.isArray(value.records) || !Array.isArray(value.activeShiftRecords)) throw new Error('打刻状態を確認できません')
  const seen = new Map<string, KintaiClockRecord>()
  let employee = ''
  for (const rows of [value.records, value.activeShiftRecords]) {
    const ids = new Set<string>()
    let previous = -Infinity
    for (const record of rows) {
      if (!isKintaiClockRecord(record) || ids.has(record.id) || Date.parse(record.timestamp) < previous
        || employee && employee !== record.employeeId) throw new Error('打刻状態を確認できません')
      const prior = seen.get(record.id)
      if (prior && (prior.type !== record.type || prior.timestamp !== record.timestamp || prior.employeeId !== record.employeeId)) throw new Error('打刻状態を確認できません')
      ids.add(record.id); seen.set(record.id, record); employee = record.employeeId; previous = Date.parse(record.timestamp)
    }
  }
  const records = value.records as KintaiClockRecord[]
  const active = value.activeShiftRecords as KintaiClockRecord[]
  const last = active[active.length - 1]
  const expected = !last ? 'not_clocked_in' : last.type === 'clock_out' ? 'clocked_out' : last.type === 'break_start' ? 'on_break' : 'working'
  if (value.clockStatus !== expected || records.some(record => new Date(record.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) !== date)) throw new Error('打刻状態を確認できません')
  return { records, activeShiftRecords: active, clockStatus: expected, date }
}
