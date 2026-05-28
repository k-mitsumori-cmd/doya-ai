export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { recalculateDayForEmployee } from '@/lib/kintai/recalculate'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'manager')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date') || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

    // @db.Date フィールドはUTC midnightで保存されるためUTC基準でクエリ
    const dateObj = new Date(dateParam + 'T00:00:00.000Z')
    const nextDay = new Date(dateObj.getTime() + 86400000)

    const allEmployees = await prisma.kintaiEmployee.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: { department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    let attendances = await prisma.kintaiAttendance.findMany({
      where: {
        employeeId: { in: allEmployees.map(e => e.id) },
        date: { gte: dateObj, lt: nextDay },
      },
    })

    // 勤務時間0のレコードを自動再計算
    const stale = attendances.filter(a => a.clockIn && a.workMinutes === 0 && a.clockOut)
    if (stale.length > 0) {
      for (const att of stale) {
        await recalculateDayForEmployee(att.employeeId, ctx.organizationId, att.date)
      }
      attendances = await prisma.kintaiAttendance.findMany({
        where: {
          employeeId: { in: allEmployees.map(e => e.id) },
          date: { gte: dateObj, lt: nextDay },
        },
      })
    }

    const attMap = new Map(attendances.map(a => [a.employeeId, a]))

    // 出勤中（退勤前）の従業員をclock recordsから検出
    const jstOffsetMs = 9 * 60 * 60 * 1000
    const clockDayStart = new Date(dateObj.getTime() - jstOffsetMs)
    const clockDayEnd = new Date(clockDayStart.getTime() + 86400000)
    const todayClockRecords = await prisma.kintaiClockRecord.findMany({
      where: {
        employeeId: { in: allEmployees.map(e => e.id) },
        timestamp: { gte: clockDayStart, lt: clockDayEnd },
      },
      orderBy: { timestamp: 'asc' },
    })

    // 従業員ごとにclock recordsをグループ化
    const clockMap = new Map<string, typeof todayClockRecords>()
    todayClockRecords.forEach(r => {
      const arr = clockMap.get(r.employeeId) || []
      arr.push(r)
      clockMap.set(r.employeeId, arr)
    })

    const employees = allEmployees.map(emp => {
      const att = attMap.get(emp.id) || null
      const records = clockMap.get(emp.id) || []

      // attendanceレコードがなくてもclock_inがあれば出勤中として返す
      if (!att && records.length > 0) {
        const clockIn = records.find(r => r.type === 'clock_in')
        const lastRecord = records[records.length - 1]
        const isWorking = lastRecord.type !== 'clock_out'
        if (clockIn && isWorking) {
          return {
            id: emp.id,
            name: emp.name,
            departmentId: emp.departmentId,
            departmentName: emp.department?.name || null,
            attendance: {
              clockIn: clockIn.timestamp,
              clockOut: null,
              workMinutes: 0,
              overtimeMinutes: 0,
              breakMinutes: 0,
              lateMinutes: 0,
              status: 'working',
            },
          }
        }
      }

      return {
        id: emp.id,
        name: emp.name,
        departmentId: emp.departmentId,
        departmentName: emp.department?.name || null,
        attendance: att,
      }
    })

    return NextResponse.json({ employees })
  } catch (e) {
    console.error('[kintai/attendance/admin GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
