import { readHrOrgChartPage, HrOrgChartPageError } from '@/lib/hr/org-chart-pagination'
import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { OrgChartNode } from '@/lib/hr/types'

function buildOrgTree(
  departments: any[],
  employeesByDept: Map<string, any[]>,
  parentId: string | null = null
): OrgChartNode[] {
  return departments
    .filter((d) => d.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({
      department: {
        id: d.id,
        name: d.name,
        code: d.code,
        managerId: d.managerId,
      },
      employees: (employeesByDept.get(d.id) || []).map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        position: e.position,
        photoUrl: e.photoUrl,
        employeeNumber: e.employeeNumber,
      })),
      children: buildOrgTree(departments, employeesByDept, d.id),
    }))
}

export async function GET(req: Request) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    if (req) {
      const params = new URL(req.url).searchParams
      if (params.get('format') === 'pages') {
        if (params.getAll('format').length !== 1 || params.getAll('cursor').length > 1) {
          return privateApiJson({ error: '組織図の取得条件が正しくありません', code: 'INVALID_ORG_CHART_CURSOR' }, { status: 400 })
        }
        return privateApiJson(await readHrOrgChartPage(prisma, ctx, params.get('cursor')))
      }
    }

    const [org, departments, employees] = await Promise.all([
      prisma.hrOrganization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      }),
      prisma.hrDepartment.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.hrEmployee.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
          ...(!hasMinRole(ctx.role, 'MANAGER') ? { id: ctx.employeeId || { in: [] } } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          photoUrl: true,
          employeeNumber: true,
          departmentId: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ])

    // An inactive parent must not hide an otherwise active child department.
    const activeDepartmentIds = new Set(departments.map(d => d.id))
    const visibleDepartments = departments.map(d => ({
      ...d, parentId: d.parentId && activeDepartmentIds.has(d.parentId) ? d.parentId : null,
    }))
    const employeesByDept = new Map<string, any[]>()
    for (const emp of employees) {
      const key = emp.departmentId && activeDepartmentIds.has(emp.departmentId) ? emp.departmentId : '__unassigned__'
      if (!employeesByDept.has(key)) employeesByDept.set(key, [])
      employeesByDept.get(key)!.push(emp)
    }

    const tree = buildOrgTree(visibleDepartments, employeesByDept)
    const unassigned = employeesByDept.get('__unassigned__') || []

    return privateApiJson({
      success: true,
      orgName: org?.name || '',
      orgChart: tree,
      unassignedEmployees: unassigned.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        position: e.position,
        photoUrl: e.photoUrl,
        employeeNumber: e.employeeNumber,
      })),
    })
  } catch (e: any) {
    if (e instanceof HrOrgChartPageError) return privateApiJson({ error: e.status === 409 ? '組織図が更新されました。再取得してください' : e.status === 401 ? 'ログイン状態を確認してください' : '組織図の取得条件が正しくありません', code: e.code }, { status: e.status })
    console.error('[hr/org-chart] unexpected error')
    return privateApiJson(
      { error: 'Failed to fetch org chart' },
      { status: 500 }
    )
  }
}
