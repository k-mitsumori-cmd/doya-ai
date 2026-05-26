export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/hr/constants'
import { checkEmployeeLimit } from '@/lib/hr/billing'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = req.nextUrl
    const search = url.searchParams.get('search') || ''
    const departmentId = url.searchParams.get('departmentId') || ''
    const status = url.searchParams.get('status') || ''
    const employmentType = url.searchParams.get('employmentType') || ''
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)))
    )

    const where: any = { organizationId: ctx.organizationId }

    if (search) {
      where.OR = [
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastNameKana: { contains: search, mode: 'insensitive' } },
        { firstNameKana: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status
    if (employmentType) where.employmentType = employmentType

    const [items, total] = await Promise.all([
      prisma.hrEmployee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hrEmployee.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      departmentId,
      position,
      grade,
      employmentType,
      hireDate,
      birthDate,
      gender,
      notes,
      customFieldValues,
    } = body

    if (!lastName || !firstName) {
      return NextResponse.json({ error: 'lastName and firstName are required' }, { status: 400 })
    }

    // プラン制限チェック
    const limitError = await checkEmployeeLimit(ctx.organizationId)
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 403 })
    }

    if (departmentId) {
      const dept = await prisma.hrDepartment.findFirst({
        where: { id: departmentId, organizationId: ctx.organizationId },
      })
      if (!dept) {
        return NextResponse.json({ error: 'Department not found' }, { status: 400 })
      }
    }

    const employee = await prisma.hrEmployee.create({
      data: {
        organizationId: ctx.organizationId,
        employeeNumber: employeeNumber || null,
        lastName,
        firstName,
        lastNameKana: lastNameKana || null,
        firstNameKana: firstNameKana || null,
        email: email || null,
        phone: phone || null,
        departmentId: departmentId || null,
        position: position || null,
        grade: grade || null,
        employmentType: employmentType || 'FULL_TIME',
        hireDate: hireDate ? new Date(hireDate) : null,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
        customFieldValues: customFieldValues || null,
        status: 'ACTIVE',
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    })

    await prisma.hrEmployeeHistory.create({
      data: {
        employeeId: employee.id,
        changeType: 'HIRE',
        newDepartment: employee.department?.name || null,
        newPosition: position || null,
        newGrade: grade || null,
        effectiveDate: hireDate ? new Date(hireDate) : new Date(),
        reason: 'New hire',
      },
    })

    return NextResponse.json({ success: true, employee })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create employee' },
      { status: 500 }
    )
  }
}
