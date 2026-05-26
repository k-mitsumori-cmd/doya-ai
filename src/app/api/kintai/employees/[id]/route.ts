export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const employee = await prisma.kintaiEmployee.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
      include: { department: true, workRule: true, member: { select: { role: true } } },
    })
    if (!employee) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    return NextResponse.json({ employee })
  } catch (e) {
    console.error('[kintai/employees/[id] GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx || !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const body = await req.json()
    const { name, nameKana, email, departmentId, workRuleId, employmentType, hireDate, isActive, role } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (nameKana !== undefined) data.nameKana = nameKana
    if (email !== undefined) data.email = email
    if (departmentId !== undefined) data.departmentId = departmentId || null
    if (workRuleId !== undefined) data.workRuleId = workRuleId || null
    if (employmentType !== undefined) data.employmentType = employmentType
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null
    if (isActive !== undefined) data.isActive = isActive

    const employee = await prisma.kintaiEmployee.update({
      where: { id: p.id },
      data,
      include: { department: true, workRule: true, member: { select: { id: true, role: true } } },
    })

    if (role && employee.member) {
      await prisma.kintaiMember.update({
        where: { id: employee.member.id },
        data: { role },
      })
    }

    return NextResponse.json({ employee })
  } catch (e) {
    console.error('[kintai/employees/[id] PATCH]', e)
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
    await prisma.kintaiEmployee.update({
      where: { id: p.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[kintai/employees/[id] DELETE]', e)
    return NextResponse.json({ error: '無効化に失敗しました' }, { status: 500 })
  }
}
