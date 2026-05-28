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

    const organizations = await prisma.kintaiOrganization.findMany({
      include: {
        members: { select: { id: true, role: true, status: true, userId: true } },
        departments: { select: { id: true, name: true } },
        workRules: { select: { id: true, name: true, workStart: true, workEnd: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 従業員を別途取得（employeesリレーションが存在しないため）
    const allEmployees = await prisma.kintaiEmployee.findMany({
      where: { organizationId: { in: organizations.map(o => o.id) } },
      select: { id: true, name: true, email: true, isActive: true, employmentType: true, organizationId: true },
    })
    const empByOrg = new Map<string, typeof allEmployees>()
    allEmployees.forEach(e => {
      const list = empByOrg.get(e.organizationId) || []
      list.push(e)
      empByOrg.set(e.organizationId, list)
    })

    const result = organizations.map(org => {
      const employees = empByOrg.get(org.id) || []
      const adminMember = org.members.find(m => m.role === 'system_admin' && m.status === 'ACTIVE')
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt,
        employees,
        activeCount: employees.filter(e => e.isActive).length,
        pendingCount: org.members.filter(m => m.status === 'PENDING').length,
        departments: org.departments,
        workRules: org.workRules,
        adminUserId: adminMember?.userId || null,
      }
    })

    return NextResponse.json({ organizations: result })
  } catch (e) {
    console.error('[admin/kintai/organizations]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
