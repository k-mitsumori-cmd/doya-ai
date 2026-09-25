export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { getOneOnOneReadWhere, getOneOnOneViewer, filterOneOnOneFields } from '@/lib/hr/one-on-one-access'
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
    const page = Number(url.searchParams.get('page') || '1')
    const requestedPageSize = Number(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE))
    if (!Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
      return NextResponse.json({ error: 'ページ番号・件数が不正です' }, { status: 400 })
    }
    const pageSize = Math.min(MAX_PAGE_SIZE, requestedPageSize)

    const viewer = await getOneOnOneViewer(ctx)
    const where: any = await getOneOnOneReadWhere(ctx)
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
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hrOneOnOne.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      canCreateOneOnOne: !!viewer && (viewer.employeeId === null || ctx.role === 'MANAGER'),
      creationManagerId: viewer?.employeeId ?? null,
      items: items.map((o) => filterOneOnOneFields({
        ...o,
        agenda: o.agenda as any,
        aiActionItems: o.aiActionItems as any,
        aiInsights: o.aiInsights as any,
      }, viewer)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    console.error('[hr/one-on-one] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to fetch 1on1 records' },
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

    const viewer = await getOneOnOneViewer(ctx)
    if (!viewer || (viewer.employeeId !== null && ctx.role !== 'MANAGER')) {
      return NextResponse.json({ error: '1on1の作成は担当上司・管理者のみ実行できます' }, { status: 403 })
    }
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '入力内容が不正です' }, { status: 400 })
    const {
      employeeId,
      managerId,
      scheduledAt,
      agenda,
      duration,
    } = body

    if (typeof employeeId !== 'string' || !employeeId || typeof managerId !== 'string' || !managerId || employeeId === managerId) {
      return NextResponse.json(
        { error: 'employeeId and managerId are required' },
        { status: 400 }
      )
    }
    if (viewer.employeeId !== null && managerId !== viewer.employeeId) {
      return NextResponse.json({ error: '別の担当上司として1on1を作成する権限がありません' }, { status: 403 })
    }
    if (duration !== undefined && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) {
      return NextResponse.json({ error: '時間は1〜1440分で入力してください' }, { status: 400 })
    }

    if (scheduledAt !== undefined && scheduledAt !== null && (typeof scheduledAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(scheduledAt) || !Number.isFinite(new Date(scheduledAt).getTime()))) {
      return NextResponse.json({ error: '日時にはタイムゾーンを含む有効な日時を指定してください' }, { status: 400 })
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
        duration: duration ?? null,
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
    console.error('[hr/one-on-one] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to create 1on1 record' },
      { status: 500 }
    )
  }
}
