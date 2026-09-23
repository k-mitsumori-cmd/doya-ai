export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const kctx = await getKintaiContext()
    if (!kctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const p = await ctx.params

    // SEC: 自分自身のデータまたはhr_admin以上のみアクセス可能
    const isSelf = kctx.employeeId === p.id
    if (!isSelf && !hasMinRole(kctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const employee = await prisma.kintaiEmployee.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
      include: { department: true, workRule: true, member: { select: { id: true, role: true, status: true } } },
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

    const p = await ctx.params

    const body = await req.json()
    const { name, nameKana, email, departmentId, workRuleId, employmentType, hireDate, isActive, role } = body

    const allowedRoles = ['employee', 'manager', 'hr_admin', 'system_admin']
    if (role !== undefined && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
    }

    const data: any = {}
    if (name !== undefined) data.name = name
    if (nameKana !== undefined) data.nameKana = nameKana
    if (email !== undefined) data.email = email
    if (departmentId !== undefined) data.departmentId = departmentId || null
    if (workRuleId !== undefined) data.workRuleId = workRuleId || null
    if (employmentType !== undefined) data.employmentType = employmentType
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null
    if (isActive !== undefined) data.isActive = isActive

    return await prisma.$transaction(async (tx) => {
      const existingEmp = await tx.kintaiEmployee.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
        include: { member: { select: { id: true, role: true } } },
      })
      if (!existingEmp) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      const roleChanged = role !== undefined && !!existingEmp.member && role !== existingEmp.member.role
      if (roleChanged && kctx.role !== 'system_admin' &&
          (role === 'system_admin' || existingEmp.member?.role === 'system_admin')) {
        return NextResponse.json({ error: 'システム管理者の権限変更はシステム管理者のみ可能です' }, { status: 403 })
      }

      // すべての検証後に保存し、権限更新が失敗した場合は従業員情報も戻す。
      const employee = await tx.kintaiEmployee.update({
        where: { id: p.id },
        data,
        include: { department: true, workRule: true, member: { select: { id: true, role: true, status: true, inviteToken: true } } },
      })
      if (roleChanged && employee.member) {
        await tx.kintaiMember.update({ where: { id: employee.member.id }, data: { role } })
        employee.member.role = role
      }

      return NextResponse.json({ employee })
    })
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

    const p = await ctx.params

    // Organization scoping: verify the employee belongs to the caller's org
    const existingEmp = await prisma.kintaiEmployee.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
    })
    if (!existingEmp) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

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
