import { readHrDepartmentPage, HrDepartmentPageError } from '@/lib/hr/department-pagination'
import { buildDepartmentHierarchy, serializeDepartmentJson } from '@/lib/hr/department-hierarchy'
import { readDepartmentOperation, departmentCreationFingerprint, readDepartmentCreationReceipt, saveDepartmentCreationReceipt, DepartmentOperationConflict } from '@/lib/hr/department-operation'
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

export async function GET(req: Request) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    const expectedOrganization = req?.headers?.get('x-hr-organization-id')
    if (expectedOrganization !== undefined && expectedOrganization !== null && expectedOrganization !== ctx.organizationId) {
      return privateApiJson({ error: '組織が変更されています。設定を再読み込みしてください。' }, { status: 403 })
    }

    if (req) {
      const query = new URL(req.url).searchParams
      if (query.get('format') === 'pages') {
        if (query.getAll('format').length !== 1 || query.getAll('cursor').length > 1 ||
          [...query.keys()].some(key => key !== 'format' && key !== 'cursor')) {
          return privateApiJson({ error: '部署一覧の取得条件が正しくありません', code: 'INVALID_DEPARTMENT_CURSOR' }, { status: 400 })
        }
        return privateApiJson(await readHrDepartmentPage(prisma, ctx, query.get('cursor')))
      }
    }

    const departments = await prisma.hrDepartment.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        _count: { select: { employees: { where: { organizationId: ctx.organizationId } } } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const flat = departments.map(d => ({
      id: d.id, name: d.name, code: d.code, parentId: d.parentId,
      managerId: d.managerId, sortOrder: d.sortOrder, isActive: d.isActive,
      employeeCount: d._count.employees,
    }))
    const hierarchy = buildDepartmentHierarchy(flat)
    // Keep the legacy tree/flat contract, including deep valid trees, without recursive serialization.
    const headers = privateApiJson(null).headers
    return new Response(serializeDepartmentJson({
      success: true, organizationId: ctx.organizationId,
      departments: hierarchy.departments, flat,
    }), { headers })
  } catch (e: any) {
    if (e instanceof HrDepartmentPageError) return privateApiJson({
      error: e.status === 409 ? '部署が更新されました。再取得してください。' : e.status === 401 ? 'ログイン状態を確認してください。' : '部署一覧の取得条件が正しくありません', code: e.code,
    }, { status: e.status })
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

    const operation = readDepartmentOperation(req)
    if (operation === false) return privateApiJson({ error: '部署作成の操作情報をご確認ください' }, { status: 400 })
    if (operation && operation.organizationId !== ctx.organizationId) return privateApiJson({ error: '組織が変更されています。元の組織で作成結果を確認してください。' }, { status: 403 })
    const body = await readDepartmentInput(req, true)
    if (!body) return NextResponse.json({ error: '部署の入力内容をご確認ください。部署名は空欄にできません。' }, { status: 400 })
    const { name, code, parentId, managerId, sortOrder } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const result = await runHrDepartmentMutation(ctx, async tx => {
      if (operation) {
        const receipt = await readDepartmentCreationReceipt(tx, ctx, operation.operationId, departmentCreationFingerprint(body))
        if (receipt.state === 'created') return privateApiJson({ success: true, operationId: operation.operationId, organizationId: ctx.organizationId, state: 'created', department: receipt.department })
        if (receipt.state === 'canceled') return privateApiJson({ error: 'この作成操作は終了しています。新しい操作で作成してください。', state: 'canceled' }, { status: 409 })
        if (receipt.state === 'deleted') return privateApiJson({ error: '作成済みの部署は削除されています。自動で再作成されることはありません。', state: 'deleted' }, { status: 410 })
      }

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

      if (operation) {
        await saveDepartmentCreationReceipt(tx, ctx, operation.operationId, departmentCreationFingerprint(body), department)
        return privateApiJson({ success: true, operationId: operation.operationId, organizationId: ctx.organizationId, state: 'created', department })
      }
      return NextResponse.json({ success: true, department })
    })
    if (!result.allowed) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    return result.value
  } catch (e: any) {
    if (e instanceof DepartmentOperationConflict) return privateApiJson({ error: '同じ操作の入力内容が変わっています。前回の作成結果を確認してください。' }, { status: 409 })
    if (e?.code === 'P2002') return NextResponse.json({ error: '部署コードはすでに使用されています。別のコードを指定してください。' }, { status: 400 })
    console.error('[hr/departments] unexpected error')
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    )
  }
}
