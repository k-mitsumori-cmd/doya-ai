export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { validDepartmentParent } from '@/lib/department-integrity'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'

export async function GET() {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const departments = await prisma.kintaiDepartment.findMany({
      where: { organizationId: ctx.organizationId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ departments })
  } catch (e) {
    console.error('[kintai/departments GET]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const { name, parentId, managerId } = body
    if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: '部署名は必須です' }, { status: 400 })
    if ((parentId != null && typeof parentId !== 'string') || (managerId != null && typeof managerId !== 'string')) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }

    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, ctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, ctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      if (parentId && !(await validDepartmentParent(undefined, parentId, (parent) =>
        tx.kintaiDepartment.findFirst({
          where: { id: parent, organizationId: ctx.organizationId }, select: { id: true, parentId: true },
        })
      ))) return NextResponse.json({ error: '同じ組織の循環しない親部署を指定してください' }, { status: 400 })
      if (managerId) {
        const manager = await tx.kintaiEmployee.findFirst({
          where: { id: managerId, organizationId: ctx.organizationId }, select: { id: true },
        })
        if (!manager) return NextResponse.json({ error: '責任者が同じ組織に存在しません' }, { status: 400 })
      }

      const dept = await tx.kintaiDepartment.create({
        data: {
          organizationId: ctx.organizationId,
          name: name.trim(),
          parentId: parentId || null,
          managerId: managerId || null,
        },
        include: { _count: { select: { employees: true } } },
      })
      return NextResponse.json({ department: dept }, { status: 201 })
    })
  } catch (e) {
    console.error('[kintai/departments POST]')
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 })
  }
}
