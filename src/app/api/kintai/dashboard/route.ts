export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext } from '@/lib/kintai/access'
import { getClockStatus } from '@/lib/kintai/attendance'

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

    const [todayRecords, monthAttendances, recentRequests, employee] = await Promise.all([
      prisma.kintaiClockRecord.findMany({
        where: { employeeId: ctx.employeeId, timestamp: { gte: todayStart, lt: todayEnd } },
        orderBy: { timestamp: 'asc' },
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

    const clockStatus = getClockStatus(todayRecords)
    const todayAttendance = monthAttendances.find(
      (a) => new Date(a.date).toDateString() === todayStart.toDateString()
    )

    const summary = {
      totalWorkDays: monthAttendances.filter((a) => a.status === 'normal').length,
      totalWorkMinutes: monthAttendances.reduce((s, a) => s + a.workMinutes, 0),
      totalOvertimeMinutes: monthAttendances.reduce((s, a) => s + a.overtimeMinutes, 0),
      totalLateCount: monthAttendances.filter((a) => a.lateMinutes > 0).length,
    }

    return NextResponse.json({
      employee,
      clockStatus,
      todayRecords,
      todayAttendance,
      monthlySummary: summary,
      recentRequests,
    })
  } catch (e) {
    console.error('[kintai/dashboard] Error:', e)
    return NextResponse.json({ error: 'ダッシュボードの取得に失敗しました' }, { status: 500 })
  }
}
