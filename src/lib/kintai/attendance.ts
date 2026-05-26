import type { KintaiClockRecord, KintaiWorkRule, KintaiAttendance } from '@prisma/client'

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
  const clockIn = records.find(r => r.type === 'clock_in')
  const clockOut = records.find(r => r.type === 'clock_out')
  const breakStarts = records.filter(r => r.type === 'break_start')
  const breakEnds = records.filter(r => r.type === 'break_end')

  if (!clockIn) {
    return { clockIn: null, clockOut: null, breakMinutes: 0, workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, nightMinutes: 0 }
  }

  const clockInTime = new Date(clockIn.timestamp)
  const clockOutTime = clockOut ? new Date(clockOut.timestamp) : null

  let breakMinutes = 0
  for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
    breakMinutes += Math.round((new Date(breakEnds[i].timestamp).getTime() - new Date(breakStarts[i].timestamp).getTime()) / 60000)
  }

  let workMinutes = 0
  if (clockOutTime) {
    workMinutes = Math.max(0, Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000) - breakMinutes)
  }

  const wStart = workRule?.workStart || '09:00'
  const wEnd = workRule?.workEnd || '18:00'
  const wBreak = workRule?.breakMinutes || 60
  const [startH, startM] = wStart.split(':').map(Number)
  const [endH, endM] = wEnd.split(':').map(Number)
  const scheduledMinutes = (endH * 60 + endM) - (startH * 60 + startM) - wBreak

  const overtimeMinutes = Math.max(0, workMinutes - scheduledMinutes)

  const scheduledStart = new Date(clockInTime)
  scheduledStart.setHours(startH, startM, 0, 0)
  const lateMinutes = clockInTime > scheduledStart ? Math.round((clockInTime.getTime() - scheduledStart.getTime()) / 60000) : 0

  let earlyLeaveMinutes = 0
  if (clockOutTime) {
    const scheduledEnd = new Date(clockOutTime)
    scheduledEnd.setHours(endH, endM, 0, 0)
    earlyLeaveMinutes = clockOutTime < scheduledEnd ? Math.round((scheduledEnd.getTime() - clockOutTime.getTime()) / 60000) : 0
  }

  let nightMinutes = 0
  // Simplified night work calculation (22:00-05:00)
  if (clockOutTime) {
    const outH = clockOutTime.getHours()
    if (outH >= 22) nightMinutes += (outH - 22) * 60 + clockOutTime.getMinutes()
    if (outH < 5) nightMinutes += outH * 60 + clockOutTime.getMinutes()
  }

  return {
    clockIn: clockInTime,
    clockOut: clockOutTime,
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
