export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const existing = await prisma.hrEvaluationPeriod.findFirst({
      where: { id, organizationId: hrCtx.organizationId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, startDate, endDate, status, evaluationTemplate } = body

    const data: Record<string, any> = {}
    if (name !== undefined) data.name = name
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = new Date(endDate)
    if (status !== undefined) data.status = status
    if (evaluationTemplate !== undefined) data.evaluationTemplate = evaluationTemplate

    const updated = await prisma.hrEvaluationPeriod.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, period: updated })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update evaluation period' },
      { status: 500 }
    )
  }
}
