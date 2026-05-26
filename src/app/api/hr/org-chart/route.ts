export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
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

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [departments, employees] = await Promise.all([
      prisma.hrDepartment.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.hrEmployee.findMany({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
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

    const employeesByDept = new Map<string, any[]>()
    for (const emp of employees) {
      const key = emp.departmentId || '__unassigned__'
      if (!employeesByDept.has(key)) employeesByDept.set(key, [])
      employeesByDept.get(key)!.push(emp)
    }

    const tree = buildOrgTree(departments, employeesByDept)
    const unassigned = employeesByDept.get('__unassigned__') || []

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch org chart' },
      { status: 500 }
    )
  }
}
