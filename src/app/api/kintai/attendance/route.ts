export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext } from '@/lib/kintai/access'
import { hasMinRole } from '@/lib/kintai/access'

// ----------------------------------------------------------------
// GET /api/kintai/attendance?month=YYYY-MM&employee_id=xxx
// 月次の勤怠レコードを返す
// ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    const employeeIdParam = searchParams.get('employee_id')

    // 対象従業員の決定
    let targetEmployeeId = ctx.employeeId
    if (employeeIdParam) {
      // 管理者以上のみ他従業員の閲覧可
      if (!hasMinRole(ctx.role, 'hr_admin')) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      // 対象従業員が同じ組織に属するか確認
      const targetEmployee = await prisma.kintaiEmployee.findUnique({
        where: { id: employeeIdParam },
      })
      if (!targetEmployee || targetEmployee.organizationId !== ctx.organizationId) {
        return NextResponse.json({ error: '従業員が見つかりません' }, { status: 404 })
      }
      targetEmployeeId = employeeIdParam
    }

    // 月の範囲を計算
    let year: number
    let month: number

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      year = y
      month = m
    } else {
      // 今月（JST）
      const now = new Date()
      const jstOffset = 9 * 60 * 60 * 1000
      const jstNow = new Date(now.getTime() + jstOffset)
      year = jstNow.getUTCFullYear()
      month = jstNow.getUTCMonth() + 1
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 1))

    const attendances = await prisma.kintaiAttendance.findMany({
      where: {
        employeeId: targetEmployeeId,
        date: { gte: monthStart, lt: monthEnd },
      },
      orderBy: { date: 'asc' },
    })

    // 月間サマリーを計算
    const summary = {
      totalWorkDays: attendances.filter(a => a.workMinutes > 0).length,
      totalWorkMinutes: attendances.reduce((sum, a) => sum + a.workMinutes, 0),
      totalOvertimeMinutes: attendances.reduce((sum, a) => sum + a.overtimeMinutes, 0),
      totalLateMinutes: attendances.reduce((sum, a) => sum + a.lateMinutes, 0),
      totalEarlyLeaveMinutes: attendances.reduce((sum, a) => sum + a.earlyLeaveMinutes, 0),
      totalNightMinutes: attendances.reduce((sum, a) => sum + a.nightMinutes, 0),
      totalAbsentDays: attendances.filter(a => a.status === 'absent').length,
      totalLeaveDays: attendances.filter(a => a.status === 'paid_leave' || a.status === 'special_leave').length,
      totalHolidayWorkDays: attendances.filter(a => a.holidayWork).length,
    }

    return NextResponse.json({
      attendances,
      summary,
      year,
      month,
    })
  } catch (error) {
    console.error('[kintai/attendance GET]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
