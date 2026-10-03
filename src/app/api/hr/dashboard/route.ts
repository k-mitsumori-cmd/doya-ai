export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getEvaluationReadWhere } from '@/lib/hr/evaluation-access'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { hrJstMonthRange } from '@/lib/hr/billing'
import { getOneOnOneReadWhere } from '@/lib/hr/one-on-one-access'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const evaluationWhere = await getEvaluationReadWhere(ctx)
    const oneOnOneWhere = await getOneOnOneReadWhere(ctx)

    const orgId = ctx.organizationId
    const month = hrJstMonthRange()

    const [org, employeeCount, departmentCount, activeEvaluationPeriods, monthlyOneOnOnes, recentOneOnOneRecords] =
      await Promise.all([
        prisma.hrOrganization.findUnique({ where: { id: orgId }, select: { name: true } }),
        prisma.hrEmployee.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
        prisma.hrDepartment.count({ where: { organizationId: orgId, isActive: true } }),
        prisma.hrEvaluationPeriod.findMany({
          where: { organizationId: orgId, status: { in: ['OPEN', 'IN_REVIEW'] } },
          include: {
            evaluations: { where: evaluationWhere, select: { id: true, status: true } },
          },
          orderBy: { startDate: 'desc' },
          take: 5,
        }),
        prisma.hrOneOnOne.count({
          where: {
            ...oneOnOneWhere,
            conductedAt: {
              gte: month.start,
              lt: month.end,
            },
          },
        }),
        prisma.hrOneOnOne.findMany({
          where: oneOnOneWhere,
          include: {
            employee: { select: { lastName: true, firstName: true } },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
        }),
      ])

    const activeEvaluations = activeEvaluationPeriods.reduce(
      (sum, p) => sum + p.evaluations.filter((e) => e.status !== 'FINALIZED').length,
      0
    )

    const evaluationPeriods = activeEvaluationPeriods.map((p) => ({
      id: p.id,
      name: p.name,
      total: p.evaluations.length,
      completed: p.evaluations.filter((e) => e.status === 'FINALIZED').length,
      progress:
        p.evaluations.length > 0
          ? Math.round((p.evaluations.filter((e) => e.status === 'FINALIZED').length / p.evaluations.length) * 100)
          : 0,
    }))

    const recentOneOnOnes = recentOneOnOneRecords.map((o) => ({
      id: o.id,
      employeeName: `${o.employee.lastName} ${o.employee.firstName}`,
      date: (o.conductedAt || o.scheduledAt || o.createdAt).toISOString(),
      status: o.status,
    }))

    return NextResponse.json({
      orgName: org?.name || '',
      canManageEmployees: hasMinRole(ctx.role, HrMemberRole.ADMIN),
      canCreatePeriods: hasMinRole(ctx.role, HrMemberRole.ADMIN),
      employeeCount,
      departmentCount,
      activeEvaluations,
      monthlyOneOnOnes,
      recentOneOnOnes,
      evaluationPeriods,
    })
  } catch (e: any) {
    console.error('[hr/dashboard] unexpected error')
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
