export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext } from '@/lib/kintai/access'
import { getClockStatusFromRecords as getClockStatus } from '@/lib/kintai/format'
import { recordsWithCarryover } from '@/lib/kintai/shift-records'

export async function GET() {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(now.getTime() + jstOffset)
    const todayStart = new Date(
      Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset
    )
    const todayEnd = new Date(todayStart.getTime() + 86400000)

    // Month boundaries in JST (converted to UTC for DB queries)
    const monthStart = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1) - jstOffset)
    const monthEnd = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() + 1, 1) - jstOffset)

    const [recentRecords, monthAttendances, recentRequests, employee] = await Promise.all([
      prisma.kintaiClockRecord.findMany({
        where: { employeeId: ctx.employeeId, timestamp: { gte: new Date(todayStart.getTime() - 86400000), lt: new Date(Math.min(todayEnd.getTime(), now.getTime() + 1000)) } },
        orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.kintaiAttendance.findMany({
        where: { employeeId: ctx.employeeId, date: { gte: monthStart, lt: monthEnd } },
        orderBy: { date: 'asc' },
      }),
      prisma.kintaiRequest.findMany({
        where: { employeeId: ctx.employeeId },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }),
      prisma.kintaiEmployee.findUnique({
        where: { id: ctx.employeeId },
        select: { name: true, email: true },
      }),
    ])

    const todayRecords = recordsWithCarryover(recentRecords, todayStart)
    const clockStatus = getClockStatus(todayRecords)
    const todayDate = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate())
    const todayAttendance = monthAttendances.find((a) => new Date(a.date).getTime() === todayDate)

    const summary = {
      totalWorkDays: monthAttendances.filter((a) => a.clockIn && !['absent', 'holiday'].includes(a.status)).length,
      totalWorkMinutes: monthAttendances.reduce((s, a) => s + a.workMinutes, 0),
      totalOvertimeMinutes: monthAttendances.reduce((s, a) => s + a.overtimeMinutes, 0),
      totalLateCount: monthAttendances.filter((a) => a.status === 'late' || a.lateMinutes > 0).length,
    }

    return NextResponse.json({
      employee,
      clockStatus,
      todayRecords,
      todayAttendance,
      monthlySummary: summary,
      recentRequests,
    })
  } catch {
    console.error('[kintai/dashboard] failed')
    return NextResponse.json({ error: 'ダッシュボードの取得に失敗しました' }, { status: 500 })
  }
}
