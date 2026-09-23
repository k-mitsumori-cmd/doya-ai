import type { KintaiClockRecord, KintaiWorkRule } from '@prisma/client'

export function calculateDailyAttendance(
  records: KintaiClockRecord[],
  workRule: KintaiWorkRule | null,
  date: Date
): {
  clockIn: Date | null
  clockOut: Date | null
  breakMinutes: number
  workMinutes: number
  overtimeMinutes: number
  lateMinutes: number
  earlyLeaveMinutes: number
  nightMinutes: number
} {
  const minuteMs = 60000
  const dayMs = 86400000
  const jstOffset = 9 * 60 * minuteMs
  const ordered = records
    .map(record => ({ type: record.type, time: new Date(record.timestamp).getTime(),
      created: record.createdAt ? new Date(record.createdAt).getTime() : 0, id: record.id || '' }))
    .filter(record => Number.isFinite(record.time))
    .sort((a, b) => a.time - b.time || a.created - b.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  let firstClockIn: Date | null = null
  let lastClockOut: Date | null = null
  let shiftOpen = false
  let workStart: number | null = null
  let breakStart: number | null = null
  let shiftBreakMs = 0
  let totalBreakMs = 0
  let shiftWork: Array<[number, number]> = []
  const completedWork: Array<[number, number]> = []

  // 種別ごとの配列番号ではなく、実際の時系列で勤務と休憩を対応づける。
  // 未退勤の勤務は完了分の集計へ混ぜず、重複・孤立打刻は区間を増やさない。
  for (const record of ordered) {
    const time = record.time
    if (record.type === 'clock_in' && !shiftOpen) {
      if (!firstClockIn) firstClockIn = new Date(time)
      shiftOpen = true
      workStart = time
      breakStart = null
      shiftBreakMs = 0
      shiftWork = []
    } else if (record.type === 'break_start' && shiftOpen && breakStart === null) {
      if (workStart !== null) shiftWork.push([workStart, time])
      workStart = null
      breakStart = time
    } else if (record.type === 'break_end' && shiftOpen && breakStart !== null) {
      shiftBreakMs += time - breakStart
      breakStart = null
      workStart = time
    } else if (record.type === 'clock_out' && shiftOpen) {
      if (workStart !== null) shiftWork.push([workStart, time])
      if (breakStart !== null) shiftBreakMs += time - breakStart
      completedWork.push(...shiftWork)
      totalBreakMs += shiftBreakMs
      lastClockOut = new Date(time)
      shiftOpen = false
      workStart = null
      breakStart = null
    }
  }
  if (shiftOpen) lastClockOut = null
  if (!firstClockIn) {
    return { clockIn: null, clockOut: null, breakMinutes: 0, workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, nightMinutes: 0 }
  }

  const workMinutes = Math.round(completedWork.reduce((sum, [start, end]) => sum + end - start, 0) / minuteMs)
  const breakMinutes = Math.round(totalBreakMs / minuteMs)
  let nightMs = 0
  for (const [start, end] of completedWork) {
    // 各JST暦日の00:00〜05:00、22:00〜24:00との重なりだけを計上する。
    const firstDay = Math.floor((start + jstOffset) / dayMs) * dayMs - jstOffset
    for (let day = firstDay; day < end; day += dayMs) {
      for (const [nightStart, nightEnd] of [[day, day + 5 * 60 * minuteMs], [day + 22 * 60 * minuteMs, day + dayMs]]) {
        nightMs += Math.max(0, Math.min(end, nightEnd) - Math.max(start, nightStart))
      }
    }
  }
  const nightMinutes = Math.round(nightMs / minuteMs)

  const wStart = workRule?.workStart || '09:00'
  const wEnd = workRule?.workEnd || '18:00'
  const wBreak = workRule?.breakMinutes ?? 60
  const [startH, startM] = wStart.split(':').map(Number)
  const [endH, endM] = wEnd.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  let endMinutes = endH * 60 + endM
  if (endMinutes < startMinutes) endMinutes += 1440
  const scheduledMinutes = Math.max(0, endMinutes - startMinutes - wBreak)
  const overtimeMinutes = Math.max(0, workMinutes - scheduledMinutes)
  const scheduledStart = new Date(date.getTime() + startMinutes * minuteMs)
  const lateMinutes = Math.max(0, Math.round((firstClockIn.getTime() - scheduledStart.getTime()) / minuteMs))
  const scheduledEnd = new Date(date.getTime() + endMinutes * minuteMs)
  const earlyLeaveMinutes = lastClockOut
    ? Math.max(0, Math.round((scheduledEnd.getTime() - lastClockOut.getTime()) / minuteMs))
    : 0

  return {
    clockIn: firstClockIn,
    clockOut: lastClockOut,
    breakMinutes,
    workMinutes,
    overtimeMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    nightMinutes,
  }
}

export function formatMinutesJa(minutes: number): string {
  if (!minutes || minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

export function getClockStatus(records: { type: string }[]): 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out' {
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
