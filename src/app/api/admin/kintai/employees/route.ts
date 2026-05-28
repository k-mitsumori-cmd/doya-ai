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
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        email: e.email,
        isActive: e.isActive,
        employmentType: e.employmentType,
        departmentName: e.department?.name || null,
        workRuleName: e.workRule?.name || null,
        organizationName: e.organization.name,
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
