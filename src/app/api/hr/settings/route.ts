export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const org = await prisma.hrOrganization.findUnique({
      where: { id: ctx.organizationId },
    })

    const memberships = await prisma.hrOrganizationMember.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const members = memberships.map((m) => ({
      id: m.id,
      name: m.user.name || '',
      email: m.user.email || m.invitedEmail || '',
      image: m.user.image || null,
      role: m.role,
      joinedAt: m.acceptedAt?.toISOString() || m.createdAt.toISOString(),
    }))

    return NextResponse.json({
      settings: {
        id: org?.id,
        name: org?.name || '',
        industry: org?.industry || '',
        employeeScale: org?.size || '',
        fiscalYearStart: org?.fiscalMonth ? String(org.fiscalMonth).padStart(2, '0') : '04',
      },
      members,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasMinRole(ctx.role, 'ADMIN')) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await req.json()
    const { name, industry, employeeScale, fiscalYearStart } = body

    await prisma.hrOrganization.update({
      where: { id: ctx.organizationId },
      data: {
        name: name || undefined,
        industry: industry || null,
        size: employeeScale || null,
        fiscalMonth: fiscalYearStart ? parseInt(fiscalYearStart) : undefined,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
