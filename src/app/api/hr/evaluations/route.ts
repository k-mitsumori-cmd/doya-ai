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
    const periodId = url.searchParams.get('periodId') || ''
    const employeeId = url.searchParams.get('employeeId') || ''
    const status = url.searchParams.get('status') || ''
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)))
    )

    const where: any = {}

    if (periodId) {
      where.periodId = periodId
      const period = await prisma.hrEvaluationPeriod.findFirst({
        where: { id: periodId, organizationId: ctx.organizationId },
      })
      if (!period) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 })
      }
    } else {
      where.period = { organizationId: ctx.organizationId }
    }

    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const [items, total] = await Promise.all([
      prisma.hrEvaluation.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true,
              position: true, departmentId: true,
              department: { select: { id: true, name: true } },
            },
          },
          evaluator: {
            select: { id: true, firstName: true, lastName: true },
          },
          period: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hrEvaluation.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      items: items.map((e) => ({
        ...e,
        goals: e.goals as any,
        competencies: e.competencies as any,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch evaluations' },
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
    const { periodId, employeeId, evaluatorId, goals, competencies } = body

    if (!periodId || !employeeId) {
      return NextResponse.json({ error: 'periodId and employeeId are required' }, { status: 400 })
    }

    const period = await prisma.hrEvaluationPeriod.findFirst({
      where: { id: periodId, organizationId: ctx.organizationId },
    })
    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    const employee = await prisma.hrEmployee.findFirst({
      where: { id: employeeId, organizationId: ctx.organizationId },
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const existing = await prisma.hrEvaluation.findFirst({
      where: { periodId, employeeId },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'この従業員の評価はこの期間に既に作成されています' },
        { status: 400 }
      )
    }

    const evaluation = await prisma.hrEvaluation.create({
      data: {
        periodId,
        employeeId,
        evaluatorId: evaluatorId || null,
        goals: goals || null,
        competencies: competencies || null,
        status: 'DRAFT',
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, position: true },
        },
        period: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, evaluation })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create evaluation' },
      { status: 500 }
    )
  }
}
