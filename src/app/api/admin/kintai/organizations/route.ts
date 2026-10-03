export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

const ORGANIZATIONS_PAGE_SIZE = 20
const EMPLOYEES_PAGE_SIZE = 25

function parsePage(value: string | null): number | null {
  if (value === null) return 1
  if (!/^[1-9]\d{0,6}$/.test(value)) return null
  const page = Number(value)
  return page <= 1000000 ? page : null
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })

    const url = req.nextUrl
    const organizationId = url.searchParams.get('organizationId')
    const page = parsePage(url.searchParams.get(organizationId ? 'employeePage' : 'page'))
    if (!page || (organizationId !== null && (organizationId.length === 0 || organizationId.length > 128))) {
      return NextResponse.json({ error: '取得位置が不正です' }, { status: 400 })
    }

    if (organizationId) {
      const organization = await prisma.kintaiOrganization.findUnique({ where: { id: organizationId }, select: { id: true } })
      if (!organization) return NextResponse.json({ error: '組織が見つかりません' }, { status: 404 })

      const where = { organizationId }
      const [employees, total] = await Promise.all([
        prisma.kintaiEmployee.findMany({
          where,
          select: { id: true, name: true, email: true, isActive: true, employmentType: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * EMPLOYEES_PAGE_SIZE,
          take: EMPLOYEES_PAGE_SIZE,
        }),
        prisma.kintaiEmployee.count({ where }),
      ])
      return NextResponse.json({ employees, total, page, pageSize: EMPLOYEES_PAGE_SIZE, totalPages: Math.ceil(total / EMPLOYEES_PAGE_SIZE) })
    }

    const [organizations, total] = await Promise.all([
      prisma.kintaiOrganization.findMany({
        select: {
          id: true, name: true, slug: true, createdAt: true,
          departments: { select: { id: true, name: true } },
          workRules: { select: { id: true, name: true, workStart: true, workEnd: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ORGANIZATIONS_PAGE_SIZE,
        take: ORGANIZATIONS_PAGE_SIZE,
      }),
      prisma.kintaiOrganization.count(),
    ])

    const ids = organizations.map(org => org.id)
    const [activeCounts, pendingCounts] = ids.length ? await Promise.all([
      prisma.kintaiEmployee.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids }, isActive: true },
        _count: { _all: true },
      }),
      prisma.kintaiMember.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids }, status: 'PENDING' },
        _count: { _all: true },
      }),
    ]) : [[], []]
    const activeByOrg = new Map(activeCounts.map(row => [row.organizationId, row._count._all]))
    const pendingByOrg = new Map(pendingCounts.map(row => [row.organizationId, row._count._all]))

    return NextResponse.json({
      organizations: organizations.map(org => ({
        ...org,
        activeCount: activeByOrg.get(org.id) ?? 0,
        pendingCount: pendingByOrg.get(org.id) ?? 0,
      })),
      total,
      page,
      pageSize: ORGANIZATIONS_PAGE_SIZE,
      totalPages: Math.ceil(total / ORGANIZATIONS_PAGE_SIZE),
    })
  } catch {
    console.error('[admin/kintai/organizations]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
