export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'

interface DeptNode {
  id: string
  name: string
  code: string | null
  parentId: string | null
  managerId: string | null
  sortOrder: number
  isActive: boolean
  employeeCount: number
  children: DeptNode[]
}

function buildTree(
  departments: any[],
  parentId: string | null = null
): DeptNode[] {
  return departments
    .filter((d) => d.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      parentId: d.parentId,
      managerId: d.managerId,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      employeeCount: d._count?.employees || 0,
      children: buildTree(departments, d.id),
    }))
}

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const departments = await prisma.hrDepartment.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const tree = buildTree(departments)

    return NextResponse.json({
      success: true,
      departments: tree,
      flat: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        parentId: d.parentId,
        managerId: d.managerId,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
        employeeCount: d._count.employees,
      })),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch departments' },
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
    const { name, code, parentId, managerId, sortOrder } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    if (parentId) {
      const parent = await prisma.hrDepartment.findFirst({
        where: { id: parentId, organizationId: ctx.organizationId },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent department not found' }, { status: 400 })
      }
    }

    if (code) {
      const existing = await prisma.hrDepartment.findFirst({
        where: { organizationId: ctx.organizationId, code },
      })
      if (existing) {
        return NextResponse.json({ error: 'Department code already exists' }, { status: 400 })
      }
    }

    const department = await prisma.hrDepartment.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        code: code || null,
        parentId: parentId || null,
        managerId: managerId || null,
        sortOrder: sortOrder ?? 0,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, department })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create department' },
      { status: 500 }
    )
  }
}
