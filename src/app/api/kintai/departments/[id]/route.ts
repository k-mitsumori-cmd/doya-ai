export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { name, parentId, managerId } = await req.json()

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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
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
