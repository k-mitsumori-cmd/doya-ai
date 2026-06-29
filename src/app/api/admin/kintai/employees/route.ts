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
    if (!valid) return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })

    const employees = await prisma.kintaiEmployee.findMany({
      include: {
        department: { select: { name: true } },
        workRule: { select: { name: true } },
        member: { select: { role: true, status: true, inviteEmail: true, acceptedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // KintaiEmployee には organization relation が無い（organizationId のみ）ため名前は別引きで補完
    const orgIds = Array.from(new Set(employees.map(e => e.organizationId)))
    const orgs = orgIds.length
      ? await prisma.kintaiOrganization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
      : []
    const orgNameById = new Map(orgs.map(o => [o.id, o.name]))

    return NextResponse.json({
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        isActive: e.isActive,
        employmentType: e.employmentType,
        departmentName: e.department?.name || null,
        workRuleName: e.workRule?.name || null,
        organizationName: orgNameById.get(e.organizationId) || null,
        role: e.member?.role || 'employee',
        memberStatus: e.member?.status || 'UNKNOWN',
        acceptedAt: e.member?.acceptedAt || null,
        createdAt: e.createdAt,
      })),
    })
  } catch (e) {
    console.error('[admin/kintai/employees]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
