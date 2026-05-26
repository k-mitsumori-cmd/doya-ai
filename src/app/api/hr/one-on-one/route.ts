export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/hr/constants'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = req.nextUrl
    const employeeId = url.searchParams.get('employeeId') || ''
    const managerId = url.searchParams.get('managerId') || ''
    const status = url.searchParams.get('status') || ''
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)))
    )

    const where: any = { organizationId: ctx.organizationId }
    if (employeeId) where.employeeId = employeeId
    if (managerId) where.managerId = managerId
    if (status) where.status = status

    const [items, total] = await Promise.all([
      prisma.hrOneOnOne.findMany({
        where,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, position: true },
          },
          manager: {
            select: { id: true, firstName: true, lastName: true, position: true },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hrOneOnOne.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      items: items.map((o) => ({
        ...o,
        agenda: o.agenda as any,
        aiActionItems: o.aiActionItems as any,
        aiInsights: o.aiInsights as any,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch 1on1 records' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      employeeId,
      managerId,
      scheduledAt,
      agenda,
    } = body

    if (!employeeId || !managerId) {
      return NextResponse.json(
        { error: 'employeeId and managerId are required' },
        { status: 400 }
      )
    }

    const [employee, manager] = await Promise.all([
      prisma.hrEmployee.findFirst({
        where: { id: employeeId, organizationId: ctx.organizationId },
      }),
      prisma.hrEmployee.findFirst({
        where: { id: managerId, organizationId: ctx.organizationId },
      }),
    ])
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    const oneOnOne = await prisma.hrOneOnOne.create({
      data: {
        organizationId: ctx.organizationId,
        employeeId,
        managerId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        agenda: agenda || null,
        status: 'SCHEDULED',
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    return NextResponse.json({ success: true, oneOnOne })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create 1on1 record' },
      { status: 500 }
    )
  }
}
