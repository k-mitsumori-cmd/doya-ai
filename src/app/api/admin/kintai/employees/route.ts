export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 50
const STATUSES = new Set(['ACTIVE', 'PENDING', 'INACTIVE'])

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })

    const params = req.nextUrl.searchParams
    const rawPage = params.get('page') || '1'
    const search = (params.get('search') || '').trim()
    const status = params.get('status') || ''
    if (!/^[1-9]\d{0,6}$/.test(rawPage) || Number(rawPage) > 1000000 || search.length > 100 ||
      (status && !STATUSES.has(status))) {
      return NextResponse.json({ error: '検索条件または取得位置が不正です' }, { status: 400 })
    }
    const page = Number(rawPage)

    const matchingOrganizations = search ? await prisma.kintaiOrganization.findMany({
      where: { name: { contains: search, mode: 'insensitive' } },
      select: { id: true },
    }) : []
    const where: Prisma.KintaiEmployeeWhereInput = {
      ...(status ? { member: { status } } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { organizationId: { in: matchingOrganizations.map(org => org.id) } },
      ] } : {}),
    }

    const [employees, total] = await Promise.all([
      prisma.kintaiEmployee.findMany({
        where,
        include: {
          department: { select: { name: true } },
          member: { select: { role: true, status: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.kintaiEmployee.count({ where }),
    ])

    const orgIds = Array.from(new Set(employees.map(employee => employee.organizationId)))
    const organizations = orgIds.length ? await prisma.kintaiOrganization.findMany({
      where: { id: { in: orgIds } }, select: { id: true, name: true },
    }) : []
    const orgNameById = new Map(organizations.map(org => [org.id, org.name]))

    return NextResponse.json({
      employees: employees.map(employee => ({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        organizationName: orgNameById.get(employee.organizationId) || null,
        role: employee.member?.role || 'employee',
        memberStatus: employee.member?.status || 'UNKNOWN',
        departmentName: employee.department?.name || null,
        createdAt: employee.createdAt,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    })
  } catch {
    console.error('[admin/kintai/employees]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
