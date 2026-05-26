export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''

    const where: any = {}

    if (hasMinRole(ctx.role, 'hr_admin')) {
      const empIds = await prisma.kintaiEmployee.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true },
      })
      where.employeeId = { in: empIds.map((e) => e.id) }
    } else if (hasMinRole(ctx.role, 'manager')) {
      const myEmp = await prisma.kintaiEmployee.findUnique({
        where: { id: ctx.employeeId },
        select: { departmentId: true },
      })
      if (myEmp?.departmentId) {
        const deptEmps = await prisma.kintaiEmployee.findMany({
          where: { departmentId: myEmp.departmentId },
          select: { id: true },
        })
        where.employeeId = { in: deptEmps.map((e) => e.id) }
      } else {
        where.employeeId = ctx.employeeId
      }
    } else {
      where.employeeId = ctx.employeeId
    }

    if (status) where.status = status
    if (type) where.type = type

    const requests = await prisma.kintaiRequest.findMany({
      where,
      include: { employee: { select: { name: true, email: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ requests })
  } catch (e) {
    console.error('[kintai/requests GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { type, details, reason } = await req.json()
    if (!type) return NextResponse.json({ error: '申請種別は必須です' }, { status: 400 })

    const request = await prisma.kintaiRequest.create({
      data: {
        employeeId: ctx.employeeId,
        type,
        details: details || {},
        reason: reason || null,
        status: 'pending',
      },
      include: { employee: { select: { name: true } } },
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (e) {
    console.error('[kintai/requests POST]', e)
    return NextResponse.json({ error: '申請の作成に失敗しました' }, { status: 500 })
  }
}
