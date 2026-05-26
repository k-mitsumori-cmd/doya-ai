export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildEvaluationCommentPrompt } from '@/lib/hr/prompts'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
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

    const evaluation = await prisma.hrEvaluation.findFirst({
      where: { id },
      include: {
        employee: {
          select: {
            firstName: true, lastName: true, position: true,
            department: { select: { name: true } },
          },
        },
        period: { select: { name: true, organizationId: true } },
      },
    })

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }
    if (evaluation.period.organizationId !== hrCtx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const prompt = buildEvaluationCommentPrompt({
      employeeName: `${evaluation.employee.lastName} ${evaluation.employee.firstName}`,
      position: evaluation.employee.position,
      department: evaluation.employee.department?.name,
      periodName: evaluation.period.name,
      goals: evaluation.goals as any,
      competencies: evaluation.competencies as any,
      selfRating: evaluation.selfRating,
      managerRating: evaluation.managerRating,
      selfComment: evaluation.selfComment,
      managerComment: evaluation.managerComment,
    })

    const aiComment = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
    })

    await prisma.hrEvaluation.update({
      where: { id },
      data: { aiComment },
    })

    return NextResponse.json({ success: true, aiComment })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to generate AI comment' },
      { status: 500 }
    )
  }
}
