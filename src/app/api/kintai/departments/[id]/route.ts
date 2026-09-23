export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { validDepartmentParent } from '@/lib/department-integrity'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params

    // Organization scoping: verify the department belongs to the caller's org
    const existing = await prisma.kintaiDepartment.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
    })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const { name, parentId, managerId } = await req.json()

    if (parentId && !(await validDepartmentParent(p.id, parentId, (parent) =>
      prisma.kintaiDepartment.findFirst({
        where: { id: parent, organizationId: kctx.organizationId }, select: { id: true, parentId: true },
      })
    ))) return NextResponse.json({ error: '同じ組織の循環しない親部署を指定してください' }, { status: 400 })
    if (managerId) {
      const manager = await prisma.kintaiEmployee.findFirst({
        where: { id: managerId, organizationId: kctx.organizationId }, select: { id: true },
      })
      if (!manager) return NextResponse.json({ error: '責任者が同じ組織に存在しません' }, { status: 400 })
    }

    const dept = await prisma.kintaiDepartment.update({
      where: { id: p.id },
      data: {
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(managerId !== undefined && { managerId: managerId || null }),
      },
    })

    return NextResponse.json({ department: dept })
  } catch (e) {
    console.error('[kintai/departments/[id] PATCH]', e)
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

    // Organization scoping: verify the department belongs to the caller's org
    const existing = await prisma.kintaiDepartment.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
    })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const empCount = await prisma.kintaiEmployee.count({ where: { departmentId: p.id } })
    if (empCount > 0) {
      return NextResponse.json({ error: '従業員が所属しているため削除できません' }, { status: 400 })
    }

    await prisma.kintaiDepartment.delete({ where: { id: p.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[kintai/departments/[id] DELETE]', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
