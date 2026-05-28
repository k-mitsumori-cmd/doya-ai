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
        employees: { select: { id: true, name: true, email: true, isActive: true, employmentType: true } },
        members: { select: { id: true, role: true, status: true, userId: true } },
        departments: { select: { id: true, name: true } },
        workRules: { select: { id: true, name: true, workStart: true, workEnd: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = organizations.map(org => {
      const adminMember = org.members.find(m => m.role === 'system_admin' && m.status === 'ACTIVE')
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt,
        employees: org.employees,
        activeCount: org.employees.filter(e => e.isActive).length,
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
