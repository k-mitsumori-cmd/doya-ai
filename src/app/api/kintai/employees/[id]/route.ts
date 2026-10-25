export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'
import { kintaiEmployeeLimitPayload, lockKintaiEmployeeAdmission, reachedKintaiEmployeeLimit } from '@/lib/kintai/employee-admission'
import { lockCurrentKintaiManager } from '@/lib/kintai/manager-admission'

type Ctx = { params: Promise<{ id: string }> }

async function mutateEmployee<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034' || attempt === 2) throw error
    }
  }
  throw new Error('Kintai employee mutation retry exhausted')
}

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
    console.error('[kintai/employees/[id] GET]')
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    const { name, nameKana, email, departmentId, workRuleId, employmentType, hireDate, isActive, role } = body

    const allowedRoles = ['employee', 'manager', 'hr_admin', 'system_admin']
    if (role !== undefined && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: '無効なロールです' }, { status: 400 })
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActiveが正しくありません' }, { status: 400 })
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

    return await mutateEmployee(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      const actorRole = await lockCurrentKintaiManager(tx, kctx)
      if (!actorRole) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      const existingEmp = await tx.kintaiEmployee.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
        include: { member: { select: { id: true, role: true } } },
      })
      if (!existingEmp) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      // システム管理者のメールアドレスは招待の宛先になる。hr_admin が書き換えて招待を出し直すと
      // 席を乗っ取れるため、システム管理者のメールアドレスはシステム管理者だけが変更できる。
      if (email !== undefined && email !== existingEmp.email && existingEmp.member?.role === 'system_admin' && actorRole !== 'system_admin') {
        return NextResponse.json({ error: 'システム管理者のメールアドレスはシステム管理者のみ変更できます' }, { status: 403 })
      }
      if (isActive === false && existingEmp.member?.role === 'system_admin') {
        return NextResponse.json({ error: 'システム管理者の権限を別の有効な管理者に引き継いでから無効化してください' }, { status: 409 })
      }
      if (isActive === true && !existingEmp.isActive) {
        const limit = await reachedKintaiEmployeeLimit(tx, kctx.organizationId)
        if (limit !== null) {
          return NextResponse.json(
            kintaiEmployeeLimitPayload(limit, kctx.userId),
            { status: 403 },
          )
        }
      }
      if (departmentId) {
        const department = await tx.kintaiDepartment.findFirst({ where: { id: departmentId, organizationId: kctx.organizationId }, select: { id: true } })
        if (!department) return NextResponse.json({ error: '指定された部署が見つかりません' }, { status: 400 })
      }
      if (workRuleId) {
        const rule = await tx.kintaiWorkRule.findFirst({ where: { id: workRuleId, organizationId: kctx.organizationId }, select: { id: true } })
        if (!rule) return NextResponse.json({ error: '指定された就業ルールが見つかりません' }, { status: 400 })
      }
      const roleChanged = role !== undefined && !!existingEmp.member && role !== existingEmp.member.role
      if (roleChanged && actorRole !== 'system_admin' &&
          (role === 'system_admin' || existingEmp.member?.role === 'system_admin')) {
        return NextResponse.json({ error: 'システム管理者の権限変更はシステム管理者のみ可能です' }, { status: 403 })
      }
      // hr_admin 同士で昇格・降格・無効化・メール変更ができると、互いの権限を奪い合えるため、
      // システム管理者以外は「自分より下の権限の人」だけを変更でき、自分と同じか上の権限は付与できない。
      if (actorRole !== 'system_admin') {
        // hasMinRole(a, b) は「a が b 以上の権限か」。未知のロールは安全側（同格以上）に倒す。
        const targetRole = existingEmp.member?.role
        const targetIsPeerOrHigher = !!targetRole && (hasMinRole(targetRole, actorRole) || !hasMinRole(targetRole, 'employee'))
        const isSelf = existingEmp.id === kctx.employeeId
        const sensitiveChange = roleChanged
          || (isActive !== undefined && isActive !== existingEmp.isActive)
          || (email !== undefined && email !== existingEmp.email)
        if (!isSelf && targetIsPeerOrHigher && sensitiveChange) {
          return NextResponse.json({ error: '自分と同じか上の権限を持つ人の権限・メールアドレス・有効状態は変更できません' }, { status: 403 })
        }
        if (roleChanged && isSelf) {
          return NextResponse.json({ error: '自分の権限は変更できません' }, { status: 403 })
        }
        if (roleChanged && hasMinRole(role, actorRole)) {
          return NextResponse.json({ error: '自分と同じか上の権限は付与できません' }, { status: 403 })
        }
      }
      if (roleChanged && existingEmp.member?.role === 'system_admin') {
        const otherAdmins = await tx.kintaiMember.count({
          where: {
            organizationId: kctx.organizationId,
            id: { not: existingEmp.member.id },
            role: 'system_admin',
            status: 'ACTIVE',
            employee: { is: { isActive: true } },
          },
        })
        if (otherAdmins === 0) {
          return NextResponse.json({ error: '最後のシステム管理者は権限を変更できません' }, { status: 409 })
        }
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
      // 招待中にメールを直したら、前のメールあての招待リンクを使えなくする（招待は出し直す）
      if (email !== undefined && email !== existingEmp.email && employee.member && employee.member.status !== 'ACTIVE') {
        await tx.kintaiMember.update({ where: { id: employee.member.id }, data: { inviteEmail: email, inviteToken: null } })
        employee.member.inviteToken = null
      }

      return NextResponse.json({ employee })
    })
  } catch (e) {
    console.error('[kintai/employees/[id] PATCH]')
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

    return await mutateEmployee(async (tx) => {
      await lockKintaiEmployeeAdmission(tx, kctx.organizationId)
      const actorRole = await lockCurrentKintaiManager(tx, kctx)
      if (!actorRole) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      const existingEmp = await tx.kintaiEmployee.findFirst({
        where: { id: p.id, organizationId: kctx.organizationId },
        include: { member: { select: { role: true } } },
      })
      if (!existingEmp) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
      if (existingEmp.member?.role === 'system_admin') {
        return NextResponse.json({ error: 'システム管理者の権限を別の有効な管理者に引き継いでから無効化してください' }, { status: 409 })
      }
      // PATCH の無効化と同じ決まり。自分自身は無効化できない。システム管理者以外は、自分と同じか上の権限の人を無効化できない
      // （hr_admin どうしで互いを無効化し合えないように。ROLES-2026-10-26.md §2.1）。未知のロールは安全側（同格以上）に倒す。
      if (existingEmp.id === kctx.employeeId) {
        return NextResponse.json({ error: '自分自身は無効化できません' }, { status: 403 })
      }
      if (actorRole !== 'system_admin') {
        const targetRole = existingEmp.member?.role
        if (targetRole && (hasMinRole(targetRole, actorRole) || !hasMinRole(targetRole, 'employee'))) {
          return NextResponse.json({ error: '自分と同じか上の権限を持つ人は無効化できません' }, { status: 403 })
        }
      }
      await tx.kintaiEmployee.update({
        where: { id: p.id },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true })
    })
  } catch (e) {
    console.error('[kintai/employees/[id] DELETE]')
    return NextResponse.json({ error: '無効化に失敗しました' }, { status: 500 })
  }
}
