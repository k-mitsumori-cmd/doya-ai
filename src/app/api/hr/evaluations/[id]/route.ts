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

    const evaluation = await prisma.hrEvaluation.findFirst({
      where: { id },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            position: true, grade: true,
            department: { select: { id: true, name: true } },
          },
        },
        evaluator: {
          select: { id: true, firstName: true, lastName: true },
        },
        period: {
          select: {
            id: true, name: true, startDate: true, endDate: true,
            organizationId: true, evaluationTemplate: true,
          },
        },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    if (evaluation.period.organizationId !== hrCtx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      evaluation: {
        ...evaluation,
        goals: evaluation.goals as any,
        competencies: evaluation.competencies as any,
        period: {
          ...evaluation.period,
          evaluationTemplate: evaluation.period.evaluationTemplate as any,
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch evaluation' },
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

    const existing = await prisma.hrEvaluation.findFirst({
      where: { id },
      include: {
        period: { select: { organizationId: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }
    if (existing.period.organizationId !== hrCtx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      evaluatorId,
      goals,
      competencies,
      selfRating,
      managerRating,
      finalRating,
      selfComment,
      managerComment,
      status,
    } = body

    const data: Record<string, any> = {}
    if (evaluatorId !== undefined) data.evaluatorId = evaluatorId || null
    if (goals !== undefined) data.goals = goals
    if (competencies !== undefined) data.competencies = competencies
    if (selfRating !== undefined) data.selfRating = selfRating
    if (managerRating !== undefined) data.managerRating = managerRating
    if (finalRating !== undefined) data.finalRating = finalRating
    if (selfComment !== undefined) data.selfComment = selfComment
    if (managerComment !== undefined) data.managerComment = managerComment
    if (status !== undefined) data.status = status

    const updated = await prisma.hrEvaluation.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      success: true,
      evaluation: {
        ...updated,
        goals: updated.goals as any,
        competencies: updated.competencies as any,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update evaluation' },
      { status: 500 }
    )
  }
}
