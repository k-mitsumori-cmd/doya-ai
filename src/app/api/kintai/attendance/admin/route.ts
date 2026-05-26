export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'manager')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date') || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

    const dateObj = new Date(dateParam + 'T00:00:00+09:00')
    const nextDay = new Date(dateObj.getTime() + 86400000)

    const allEmployees = await prisma.kintaiEmployee.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
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

    const employees = allEmployees.map(emp => ({
      id: emp.id,
      name: emp.name,
      departmentId: emp.departmentId,
      departmentName: emp.department?.name || null,
      attendance: attMap.get(emp.id) || null,
    }))

    return NextResponse.json({ employees })
  } catch (e) {
    console.error('[kintai/attendance/admin GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
