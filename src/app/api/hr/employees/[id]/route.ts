export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvaluationReadWhere } from '@/lib/hr/evaluation-access'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { EmployeeStatus } from '@/lib/hr/types'
import type { Prisma } from '@prisma/client'
import { createWithinEmployeeLimit, employeeLimitMessage } from '@/lib/hr/billing'
import { getOneOnOneReadWhere, getOneOnOneViewer, filterOneOnOneFields } from '@/lib/hr/one-on-one-access'

type Ctx = { params: Promise<{ id: string }> }

class EmployeeWriteConflict extends Error {}
const privateWriteHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
function employeeWriteScope(id: string, actor: { organizationId: string; memberId: string; userId: string }, existing: { updatedAt: Date }, sessionUserId: string) {
  if (!actor.memberId || actor.userId !== sessionUserId || !(existing.updatedAt instanceof Date) || !Number.isFinite(existing.updatedAt.getTime())) throw new EmployeeWriteConflict()
  return {
    id, organizationId: actor.organizationId, updatedAt: existing.updatedAt,
    organization: { members: { some: {
      id: actor.memberId, userId: actor.userId, organizationId: actor.organizationId,
      status: 'ACTIVE', role: { in: [HrMemberRole.OWNER, HrMemberRole.ADMIN] },
    } } },
  }
}
const writeConflictResponse = () => NextResponse.json({ error: '従業員情報または権限が更新されています。再読み込みしてからお試しください。', code: 'EMPLOYEE_WRITE_CONFLICT' }, { status: 409, headers: privateWriteHeaders })


export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = await ctx.params
    const id = p.id
    if (!hasMinRole(hrCtx.role, HrMemberRole.MANAGER) && hrCtx.employeeId !== id) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const evaluationWhere = await getEvaluationReadWhere(hrCtx)
    const oneOnOneWhere = await getOneOnOneReadWhere(hrCtx)

    const employee = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        histories: { orderBy: { effectiveDate: 'desc' }, take: 20 },
        evaluations: {
          where: evaluationWhere,
          include: { period: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        oneOnOnesAsEmployee: {
          where: oneOnOneWhere,
          include: {
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const viewer = await getOneOnOneViewer(hrCtx)
    return NextResponse.json({ success: true, canManageEmployees: hasMinRole(hrCtx.role, HrMemberRole.ADMIN), employee: { ...employee, oneOnOnesAsEmployee: employee.oneOnOnesAsEmployee.map(record => filterOneOnOneFields(record, viewer)) } })
  } catch (e: any) {
    console.error('[hr/employees/[id]] unexpected error')
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params
    const id = p.id

    const existing = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: { department: { select: { id: true, name: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) {
      const value = body.expectedUpdatedAt
      const expected = typeof value === 'string' && value.length === 24 ? new Date(value) : null
      if (!expected || !Number.isFinite(expected.getTime()) || expected.toISOString() !== value) {
        return NextResponse.json({ error: '更新日時を確認できません。再読み込みしてください。' }, { status: 400, headers: privateWriteHeaders })
      }
      if (expected.getTime() !== existing.updatedAt.getTime()) return writeConflictResponse()
    }
    const {
      employeeNumber,
      lastName,
      firstName,
      lastNameKana,
      firstNameKana,
      email,
      phone,
      photoUrl,
      thumbnailUrl,
      departmentId,
      position,
      grade,
      employmentType,
      hireDate,
      resignDate,
      birthDate,
      gender,
      status,
      notes,
      customFieldValues,
    } = body
    if (status !== undefined && !Object.values(EmployeeStatus).includes(status)) {
      return NextResponse.json({ error: '在籍状態の指定が正しくありません' }, { status: 400 })
    }

    const data: Record<string, any> = {}
    if (employeeNumber !== undefined) data.employeeNumber = employeeNumber
    if (lastName !== undefined) data.lastName = lastName
    if (firstName !== undefined) data.firstName = firstName
    if (lastNameKana !== undefined) data.lastNameKana = lastNameKana
    if (firstNameKana !== undefined) data.firstNameKana = firstNameKana
    if (email !== undefined) data.email = email
    if (phone !== undefined) data.phone = phone
    if (photoUrl !== undefined) data.photoUrl = photoUrl
    if (thumbnailUrl !== undefined) data.thumbnailUrl = thumbnailUrl
    if (departmentId !== undefined) data.departmentId = departmentId || null
    if (position !== undefined) data.position = position
    if (grade !== undefined) data.grade = grade
    if (employmentType !== undefined) data.employmentType = employmentType
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null
    if (resignDate !== undefined) data.resignDate = resignDate ? new Date(resignDate) : null
    if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null
    if (gender !== undefined) data.gender = gender
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes
    if (customFieldValues !== undefined) data.customFieldValues = customFieldValues

    const deptChanged = departmentId !== undefined && departmentId !== existing.departmentId
    const posChanged = position !== undefined && position !== existing.position
    const gradeChanged = grade !== undefined && grade !== existing.grade

    const persist = async (tx: Prisma.TransactionClient) => {
      const scope = employeeWriteScope(id, hrCtx, existing, (session?.user as any).id)
      const changed = await tx.hrEmployee.updateMany({
        where: scope,
        data: { ...data, updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) },
      })
      if (changed.count !== 1) throw new EmployeeWriteConflict()
      if (deptChanged || posChanged || gradeChanged) {
        let newDeptName: string | null = null
        if (deptChanged && departmentId) {
          const dept = await tx.hrDepartment.findFirst({
            where: { id: departmentId, organizationId: hrCtx.organizationId },
          })
          if (!dept) throw new Error('Department not found')
          newDeptName = dept.name
        }

        let changeType = 'OTHER'
        if (deptChanged && !posChanged && !gradeChanged) changeType = 'TRANSFER'
        else if (posChanged || gradeChanged) changeType = 'PROMOTION'

        await tx.hrEmployeeHistory.create({
          data: {
            employeeId: id,
            changeType,
            previousDepartment: existing.department?.name || null,
            newDepartment: deptChanged ? newDeptName : (existing.department?.name || null),
            previousPosition: existing.position || null,
            newPosition: position !== undefined ? position : existing.position,
            previousGrade: existing.grade || null,
            newGrade: grade !== undefined ? grade : existing.grade,
            effectiveDate: new Date(),
          },
        })
      }
      const current = await tx.hrEmployee.findFirst({
        where: { id, organizationId: hrCtx.organizationId, organization: scope.organization },
        include: { department: { select: { id: true, name: true, code: true } } },
      })
      if (!current) throw new EmployeeWriteConflict()
      return current
    }

    const reactivating = status === EmployeeStatus.ACTIVE && existing.status !== EmployeeStatus.ACTIVE
    const admission = reactivating
      ? await createWithinEmployeeLimit(hrCtx.organizationId, persist)
      : { allowed: true as const, value: await prisma.$transaction(persist) }
    if (!admission.allowed) {
      const canUpgrade = !['PRO', 'BUNDLE', 'ENTERPRISE'].includes(admission.plan.toUpperCase())
      return NextResponse.json({
        error: employeeLimitMessage(admission.plan, admission.limit),
        code: 'HR_ORG_EMPLOYEE_LIMIT',
        canManageBilling: hrCtx.role === HrMemberRole.OWNER,
        ...(canUpgrade ? { upgradeUrl: '/hr/pricing' } : { contactUrl: 'https://doyamarke.surisuta.jp/contact' }),
      }, { status: 403 })
    }
    const updated = admission.value

    return NextResponse.json({ success: true, employee: updated }, { headers: privateWriteHeaders })
  } catch (e: any) {
    if (e instanceof EmployeeWriteConflict) return writeConflictResponse()
    console.error('[hr/employees PATCH]')
    return NextResponse.json(
      { error: '従業員情報を更新できませんでした' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasMinRole(hrCtx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const p = await ctx.params
    const id = p.id

    const existing = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      const scope = employeeWriteScope(id, hrCtx, existing, (session?.user as any).id)
      if (existing.status === EmployeeStatus.RESIGNED) {
        const current = await tx.hrEmployee.findFirst({ where: scope, select: { id: true } })
        if (!current) throw new EmployeeWriteConflict()
        return
      }
      const changed = await tx.hrEmployee.updateMany({
        where: scope,
        data: { status: 'RESIGNED', resignDate: new Date(), updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) },
      })
      if (changed.count !== 1) throw new EmployeeWriteConflict()
      await tx.hrEmployeeHistory.create({
        data: {
          employeeId: id,
          changeType: 'RESIGN',
          effectiveDate: new Date(),
          reason: 'Logical deletion',
        },
      })
    })

    return NextResponse.json({ success: true }, { headers: privateWriteHeaders })
  } catch (e: any) {
    if (e instanceof EmployeeWriteConflict) return writeConflictResponse()
    console.error('[hr/employees DELETE]')
    return NextResponse.json(
      { error: '従業員情報を削除できませんでした' },
      { status: 500 }
    )
  }
}
