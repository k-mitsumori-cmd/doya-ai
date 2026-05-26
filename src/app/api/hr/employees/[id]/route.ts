export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const employee = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        histories: { orderBy: { effectiveDate: 'desc' }, take: 20 },
        evaluations: {
          include: { period: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        oneOnOnesAsEmployee: {
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

    return NextResponse.json({ success: true, employee })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch employee' },
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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const existing = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
      include: { department: { select: { id: true, name: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const body = await req.json()
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

    if (deptChanged || posChanged || gradeChanged) {
      let newDeptName: string | null = null
      if (deptChanged && departmentId) {
        const dept = await prisma.hrDepartment.findFirst({
          where: { id: departmentId, organizationId: hrCtx.organizationId },
        })
        newDeptName = dept?.name || null
      }

      let changeType = 'OTHER'
      if (deptChanged && !posChanged && !gradeChanged) changeType = 'TRANSFER'
      else if (posChanged || gradeChanged) changeType = 'PROMOTION'

      await prisma.hrEmployeeHistory.create({
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

    const updated = await prisma.hrEmployee.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json({ success: true, employee: updated })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update employee' },
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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const existing = await prisma.hrEmployee.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    await prisma.hrEmployee.update({
      where: { id },
      data: { status: 'RESIGNED', resignDate: new Date() },
    })

    await prisma.hrEmployeeHistory.create({
      data: {
        employeeId: id,
        changeType: 'RESIGN',
        effectiveDate: new Date(),
        reason: 'Logical deletion',
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to delete employee' },
      { status: 500 }
    )
  }
}
