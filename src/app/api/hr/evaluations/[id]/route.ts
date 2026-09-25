export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { getEvaluationRatingField } from '@/lib/hr/evaluation-access'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const hrCtx = await getHrContext()
    if (!hrCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = await ctx.params
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

    const ratingField = await getEvaluationRatingField(hrCtx, evaluation)
    if (!ratingField) {
      return NextResponse.json({ error: 'この評価を閲覧する権限がありません' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      evaluation: {
        ...evaluation,
        ratingField,
        overallScore: evaluation[ratingField] ?? 0,
        isManager: ratingField !== 'selfRating',
        employeeName: `${evaluation.employee.lastName} ${evaluation.employee.firstName}`,
        periodName: evaluation.period.name,
        goals: evaluation.goals as any,
        competencies: evaluation.competencies as any,
        period: {
          ...evaluation.period,
          evaluationTemplate: evaluation.period.evaluationTemplate as any,
        },
      },
    })
  } catch (e: any) {
    console.error('[hr/evaluations/[id]] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to fetch evaluation' },
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

    const p = await ctx.params
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

    const ratingField = await getEvaluationRatingField(hrCtx, existing)
    if (!ratingField) {
      return NextResponse.json({ error: 'この評価を操作する権限がありません' }, { status: 403 })
    }

    if (existing.status === 'FINALIZED') {
      return NextResponse.json({ error: '確定済みの評価は変更できません' }, { status: 409 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '更新内容が不正です' }, { status: 400 })
    }
    const privilegedFields = ['evaluatorId', 'status', 'finalRating']
    const denied = ratingField === 'selfRating'
      ? [...privilegedFields, 'managerRating', 'managerComment']
      : ratingField === 'managerRating' ? [...privilegedFields, 'selfRating', 'selfComment'] : []
    if (denied.some((field) => field in body)) {
      return NextResponse.json({ error: 'この評価項目を変更する権限がありません' }, { status: 403 })
    }
    for (const field of ['selfRating', 'managerRating', 'finalRating', 'overallScore']) {
      if (field in body && body[field] !== null &&
          (typeof body[field] !== 'number' || !Number.isInteger(body[field]) || body[field] < 0 || body[field] > 5)) {
        return NextResponse.json({ error: '評価点は0〜5の整数で入力してください' }, { status: 400 })
      }
    }
    if ('overallScore' in body && ratingField in body && body.overallScore !== body[ratingField]) {
      return NextResponse.json({ error: '評価点の指定が一致していません' }, { status: 400 })
    }
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

    if (evaluatorId) {
      const evaluator = await prisma.hrEmployee.findFirst({
        where: { id: evaluatorId, organizationId: hrCtx.organizationId }, select: { id: true },
      })
      if (!evaluator) return NextResponse.json({ error: '評価者が同じ組織に存在しません' }, { status: 400 })
    }

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
    if ('overallScore' in body) data[ratingField] = body.overallScore === 0 ? null : body.overallScore

    const updated = await prisma.hrEvaluation.update({
      where: { id, status: { not: 'FINALIZED' } },
      data,
    })

    return NextResponse.json({
      success: true,
      evaluation: {
        ...updated,
        ratingField,
        overallScore: updated[ratingField] ?? 0,
        isManager: ratingField !== 'selfRating',
        goals: updated.goals as any,
        competencies: updated.competencies as any,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: '評価が確定または変更されています。再読み込みして状態をご確認ください。' }, { status: 409 })
    }
    console.error('[hr/evaluations/[id]] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to update evaluation' },
      { status: 500 }
    )
  }
}
