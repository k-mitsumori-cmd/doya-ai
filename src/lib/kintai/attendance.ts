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
  const clockIns = records.filter(r => r.type === 'clock_in')
  const clockOuts = records.filter(r => r.type === 'clock_out')
  const breakStarts = records.filter(r => r.type === 'break_start')
  const breakEnds = records.filter(r => r.type === 'break_end')

  if (clockIns.length === 0) {
    return { clockIn: null, clockOut: null, breakMinutes: 0, workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, nightMinutes: 0 }
  }

  const firstClockIn = new Date(clockIns[0].timestamp)
  const lastClockOut = clockOuts.length > 0 ? new Date(clockOuts[clockOuts.length - 1].timestamp) : null

  let breakMinutes = 0
  for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
    breakMinutes += Math.round((new Date(breakEnds[i].timestamp).getTime() - new Date(breakStarts[i].timestamp).getTime()) / 60000)
  }

  let totalWorkMs = 0
  for (let i = 0; i < clockIns.length; i++) {
    const inTime = new Date(clockIns[i].timestamp).getTime()
    const outTime = i < clockOuts.length ? new Date(clockOuts[i].timestamp).getTime() : null
    if (outTime) {
      totalWorkMs += outTime - inTime
    }
  }
  let workMinutes = Math.max(0, Math.round(totalWorkMs / 60000) - breakMinutes)

  const wStart = workRule?.workStart || '09:00'
  const wEnd = workRule?.workEnd || '18:00'
  const wBreak = workRule?.breakMinutes || 60
  const [startH, startM] = wStart.split(':').map(Number)
  const [endH, endM] = wEnd.split(':').map(Number)
  const scheduledMinutes = (endH * 60 + endM) - (startH * 60 + startM) - wBreak

  const overtimeMinutes = Math.max(0, workMinutes - scheduledMinutes)

  const JST_OFFSET_MS = 9 * 60 * 60 * 1000
  const getJSTHours = (d: Date) => new Date(d.getTime() + JST_OFFSET_MS).getUTCHours()
  const getJSTMinutes = (d: Date) => new Date(d.getTime() + JST_OFFSET_MS).getUTCMinutes()

  const scheduledStart = new Date(date.getTime() + (startH * 60 + startM) * 60000)
  const lateMinutes = firstClockIn > scheduledStart ? Math.round((firstClockIn.getTime() - scheduledStart.getTime()) / 60000) : 0

  let earlyLeaveMinutes = 0
  if (lastClockOut) {
    const scheduledEnd = new Date(date.getTime() + (endH * 60 + endM) * 60000)
    earlyLeaveMinutes = lastClockOut < scheduledEnd ? Math.round((scheduledEnd.getTime() - lastClockOut.getTime()) / 60000) : 0
  }

  let nightMinutes = 0
  if (lastClockOut) {
    const outH = getJSTHours(lastClockOut)
    const outM = getJSTMinutes(lastClockOut)
    if (outH >= 22) nightMinutes += (outH - 22) * 60 + outM
    if (outH < 5) nightMinutes += outH * 60 + outM
  }

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
