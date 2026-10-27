export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { privateApiJson } from '@/lib/private-api-response'
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
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    // 2つの閲覧条件は互いに依存しないので同時に求める
    const [evaluationWhere, oneOnOneWhere] = await Promise.all([getEvaluationReadWhere(ctx), getOneOnOneReadWhere(ctx)])

    const orgId = ctx.organizationId
    const month = hrJstMonthRange()

    const [org, employeeCount, departmentCount, activeEvaluationPeriods, monthlyOneOnOnes, recentOneOnOneRecords, departmentRows] =
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
        // 部署ごとの在籍人数（ダッシュボードのインフォグラフィック。組織図と同じ情報で、名前と人数だけを返す。2026-10-27）
        // ⚠️ 飾りの情報なので、読めなくてもダッシュボードは返す（空の配列にする）
        Promise.resolve()
          .then(() => prisma.hrDepartment.findMany({
            where: { organizationId: orgId, isActive: true },
            select: { name: true, sortOrder: true, _count: { select: { employees: { where: { status: 'ACTIVE' } } } } },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          }))
          .catch(() => [] as { name: string; sortOrder: number; _count: { employees: number } }[]),
      ])

    const departmentHeadcount = departmentRows
      .map((d) => ({ name: d.name, count: d._count.employees }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)

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

    return privateApiJson({
      orgName: org?.name || '',
      canManageEmployees: hasMinRole(ctx.role, HrMemberRole.ADMIN),
      canCreatePeriods: hasMinRole(ctx.role, HrMemberRole.ADMIN),
      employeeCount,
      departmentCount,
      activeEvaluations,
      monthlyOneOnOnes,
      recentOneOnOnes,
      evaluationPeriods,
      departmentHeadcount,
    })
  } catch (e: any) {
    console.error('[hr/dashboard] unexpected error')
    return privateApiJson({ error: 'ダッシュボードを読み込めませんでした。時間をおいて再読み込みしてください。' }, { status: 500 })
  }
}
