export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(now.getTime() + jstOffset)
    const todayStart = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset)
    const monthStart = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1) - jstOffset)

    const [
      totalOrgs,
      totalEmployees,
      activeEmployees,
      pendingInvites,
      totalClockRecords,
      todayClockRecords,
      monthAttendances,
      totalRequests,
      pendingRequests,
    ] = await Promise.all([
      prisma.kintaiOrganization.count(),
      prisma.kintaiEmployee.count(),
      prisma.kintaiEmployee.count({ where: { isActive: true } }),
      prisma.kintaiMember.count({ where: { status: 'PENDING' } }),
      prisma.kintaiClockRecord.count(),
      prisma.kintaiClockRecord.count({ where: { timestamp: { gte: todayStart } } }),
      prisma.kintaiAttendance.count({ where: { date: { gte: monthStart } } }),
      prisma.kintaiRequest.count(),
      prisma.kintaiRequest.count({ where: { status: 'pending' } }),
    ])

    const organizations = await prisma.kintaiOrganization.findMany({
      include: {
        _count: {
          select: {
            members: true,
            departments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // 組織IDごとの従業員数を一括取得
    const employeeCounts = await prisma.kintaiEmployee.groupBy({
      by: ['organizationId'],
      _count: { id: true },
      where: { organizationId: { in: organizations.map(o => o.id) } },
    })
    const empCountMap = new Map(employeeCounts.map(c => [c.organizationId, c._count.id]))

    const orgList = organizations.map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      employeeCount: empCountMap.get(org.id) || 0,
      memberCount: org._count.members,
      departmentCount: org._count.departments,
    }))

    return NextResponse.json({
      stats: {
        totalOrgs,
        totalEmployees,
        activeEmployees,
        pendingInvites,
        totalClockRecords,
        todayClockRecords,
        monthAttendances,
        totalRequests,
        pendingRequests,
      },
      organizations: orgList,
    })
  } catch (e) {
    console.error('[admin/kintai]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
