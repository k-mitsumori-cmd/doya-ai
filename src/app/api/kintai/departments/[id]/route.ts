export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { validDepartmentParent } from '@/lib/department-integrity'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { lockKintaiEmployeeAdmission } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const { name, parentId, managerId } = body
    if ((name !== undefined && (typeof name !== 'string' || !name.trim())) ||
        (parentId != null && typeof parentId !== 'string') ||
        (managerId != null && typeof managerId !== 'string')) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }

    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, kctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const existing = await tx.kintaiDepartment.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
      })
      if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      if (parentId && !(await validDepartmentParent(p.id, parentId, (parent) =>
        tx.kintaiDepartment.findFirst({
          where: { id: parent, organizationId: kctx.organizationId }, select: { id: true, parentId: true },
        })
      ))) return NextResponse.json({ error: '同じ組織の循環しない親部署を指定してください' }, { status: 400 })
      if (managerId) {
        const manager = await tx.kintaiEmployee.findFirst({
          where: { id: managerId, organizationId: kctx.organizationId }, select: { id: true },
        })
        if (!manager) return NextResponse.json({ error: '責任者が同じ組織に存在しません' }, { status: 400 })
      }
      const dept = await tx.kintaiDepartment.update({
        where: { id: p.id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(parentId !== undefined && { parentId: parentId || null }),
          ...(managerId !== undefined && { managerId: managerId || null }),
        },
      })
      return NextResponse.json({ department: dept })
    })
  } catch (e) {
    console.error('[kintai/departments/[id] PATCH]')
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    return await prisma.$transaction(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      if (!(await lockCurrentKintaiManager(tx, kctx))) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const existing = await tx.kintaiDepartment.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
      })
      if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      const empCount = await tx.kintaiEmployee.count({ where: { departmentId: p.id, organizationId: kctx.organizationId } })
      if (empCount > 0) {
        return NextResponse.json({ error: '従業員が所属しているため削除できません' }, { status: 400 })
      }
      await tx.kintaiDepartment.delete({ where: { id: p.id } })
      return NextResponse.json({ success: true })
    })
  } catch (e) {
    console.error('[kintai/departments/[id] DELETE]')
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
