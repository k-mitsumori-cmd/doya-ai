export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const periods = await prisma.hrEvaluationPeriod.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        _count: { select: { evaluations: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({
      success: true,
      periods: periods.map((p) => ({
        ...p,
        evaluationTemplate: p.evaluationTemplate as any,
        evaluationCount: p._count.evaluations,
      })),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch evaluation periods' },
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

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, startDate, endDate, status, evaluationTemplate } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'name, startDate, endDate are required' }, { status: 400 })
    }

    const period = await prisma.hrEvaluationPeriod.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'DRAFT',
        evaluationTemplate: evaluationTemplate || null,
      },
    })

    return NextResponse.json({ success: true, period })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create evaluation period' },
      { status: 500 }
    )
  }
}
