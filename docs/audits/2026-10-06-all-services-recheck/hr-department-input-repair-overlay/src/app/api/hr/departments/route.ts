import { readDepartmentInput } from '@/lib/hr/department-input'
import { runHrDepartmentMutation } from '@/lib/hr/department-mutation'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validDepartmentParent } from '@/lib/department-integrity'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'

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
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    const departments = await prisma.hrDepartment.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const tree = buildTree(departments)

    return privateApiJson({
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
    console.error('[hr/departments] unexpected error')
    return privateApiJson(
      { error: 'Failed to fetch departments' },
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
    if (!hasMinRole(ctx.role, 'ADMIN')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await readDepartmentInput(req, true)
    if (!body) return NextResponse.json({ error: '部署の入力内容をご確認ください。部署名は空欄にできません。' }, { status: 400 })
    const { name, code, parentId, managerId, sortOrder } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const result = await runHrDepartmentMutation(ctx, async tx => {
      if (parentId) {
        const parent = await tx.hrDepartment.findFirst({
          where: { id: parentId, organizationId: ctx.organizationId },
        })
        if (!parent) {
          return NextResponse.json({ error: 'Parent department not found' }, { status: 400 })
        }
      }

      if (code) {
        const existing = await tx.hrDepartment.findFirst({
          where: { organizationId: ctx.organizationId, code },
        })
        if (existing) {
          return NextResponse.json({ error: 'Department code already exists' }, { status: 400 })
        }
      }

      if (parentId && !(await validDepartmentParent(undefined, parentId, (parent) =>
        tx.hrDepartment.findFirst({
          where: { id: parent, organizationId: ctx.organizationId }, select: { id: true, parentId: true },
        })
      ))) return NextResponse.json({ error: '同じ組織の循環しない親部署を指定してください' }, { status: 400 })
      if (managerId) {
        const manager = await tx.hrEmployee.findFirst({
          where: { id: managerId, organizationId: ctx.organizationId }, select: { id: true },
        })
        if (!manager) return NextResponse.json({ error: '責任者が同じ組織に存在しません' }, { status: 400 })
      }

      const department = await tx.hrDepartment.create({
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
    })
    if (!result.allowed) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    return result.value
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: '部署コードはすでに使用されています。別のコードを指定してください。' }, { status: 400 })
    console.error('[hr/departments] unexpected error')
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    )
  }
}
