export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { openShiftStart } from '@/lib/kintai/shift-records'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'manager')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const requestedDate = searchParams.get('date')
    const dateParam = requestedDate === null ? new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : requestedDate

    // @db.Date フィールドはUTC midnightで保存されるためUTC基準でクエリ
    if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(dateParam)) {
      return NextResponse.json({ error: '対象日が正しくありません' }, { status: 400 })
    }
    const dateObj = new Date(dateParam + 'T00:00:00.000Z')
    if (Number.isNaN(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== dateParam) {
      return NextResponse.json({ error: '対象日が正しくありません' }, { status: 400 })
    }
    const nextDay = new Date(dateObj.getTime() + 86400000)
    const jstOffsetMs = 9 * 60 * 60 * 1000
    const clockDayStart = new Date(dateObj.getTime() - jstOffsetMs)
    const clockDayEnd = new Date(clockDayStart.getTime() + 86400000)

    let departmentScope: { departmentId?: string; id?: string } = {}
    if (!hasMinRole(ctx.role, 'hr_admin')) {
      const viewer = await prisma.kintaiEmployee.findUnique({
        where: { id: ctx.employeeId }, select: { departmentId: true },
      })
      departmentScope = viewer?.departmentId ? { departmentId: viewer.departmentId } : { id: ctx.employeeId }
    }

    const allEmployees = await prisma.kintaiEmployee.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...departmentScope,
        OR: [
          { isActive: true },
          { attendances: { some: { date: { gte: dateObj, lt: nextDay } } } },
          { clockRecords: { some: { timestamp: { gte: clockDayStart, lt: clockDayEnd } } } },
        ],
      },
      include: { department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    const attendances = await prisma.kintaiAttendance.findMany({
      where: {
        employeeId: { in: allEmployees.map(e => e.id) },
        date: { gte: dateObj, lt: nextDay },
      },
    })

    const attMap = new Map(attendances.map(a => [a.employeeId, a]))

    // 前日から継続する勤務も管理者の出勤状況に含める。
    const relevantClockRecords = await prisma.kintaiClockRecord.findMany({
      where: {
        employeeId: { in: allEmployees.map(e => e.id) },
        timestamp: { gte: new Date(clockDayStart.getTime() - 86400000), lt: clockDayEnd },
      },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })

    // 従業員ごとにclock recordsをグループ化
    const clockMap = new Map<string, typeof relevantClockRecords>()
    relevantClockRecords.forEach(r => {
      const arr = clockMap.get(r.employeeId) || []
      arr.push(r)
      clockMap.set(r.employeeId, arr)
    })

    const employees = allEmployees.map(emp => {
      const att = attMap.get(emp.id) || null
      const records = clockMap.get(emp.id) || []

      // 日次実績が未作成でも、前日から続く未退勤シフトは出勤中として返す。
      if (!att || att.clockOut) {
        const clockIn = openShiftStart(records)
        if (clockIn) {
          return {
            id: emp.id,
            name: emp.name,
            departmentId: emp.departmentId,
            departmentName: emp.department?.name || null,
            attendance: {
              ...att,
              clockIn: clockIn.timestamp,
              clockOut: null,
              workMinutes: att?.workMinutes || 0,
              overtimeMinutes: att?.overtimeMinutes || 0,
              breakMinutes: att?.breakMinutes || 0,
              lateMinutes: att?.lateMinutes || 0,
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

    return NextResponse.json({ employees }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error('[kintai/attendance/admin GET]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
