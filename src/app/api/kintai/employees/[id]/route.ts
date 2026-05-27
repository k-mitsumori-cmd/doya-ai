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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    // Organization scoping: verify the employee belongs to the caller's org
    const existingEmp = await prisma.kintaiEmployee.findFirst({
      where: { id: p.id, organizationId: kctx.organizationId },
    })
    if (!existingEmp) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

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
      include: { department: true, workRule: true, member: { select: { id: true, role: true, status: true, inviteToken: true } } },
    })

    // SEC: ロール変更の検証
    if (role && employee.member) {
      const ALL_ROLES = ['employee', 'manager', 'hr_admin', 'system_admin']
      if (!ALL_ROLES.includes(role)) {
        return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
      }
      // system_adminロールの付与はsystem_adminのみ可能
      if (role === 'system_admin' && kctx.role !== 'system_admin') {
        return NextResponse.json({ error: 'システム管理者のみがsystem_adminを付与できます' }, { status: 403 })
      }
      // hr_adminはsystem_adminを付与不可（自分より上のロール付与禁止）
      if (role === 'system_admin' && kctx.role === 'hr_admin') {
        return NextResponse.json({ error: '権限が不足しています' }, { status: 403 })
      }
      await prisma.kintaiMember.update({
        where: { id: employee.member.id },
        data: { role },
      })
      employee.member.role = role
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
