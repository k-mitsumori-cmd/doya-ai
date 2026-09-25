export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { canReadEvaluation } from '@/lib/hr/evaluation-access'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildEvaluationCommentPrompt } from '@/lib/hr/prompts'
import { checkAiUsageLimit, incrementAiUsage } from '@/lib/hr/billing'

type Ctx = { params: Promise<{ id: string }> }

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

    const p = await ctx.params
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

    if (!(await canReadEvaluation(hrCtx, evaluation))) {
      return NextResponse.json({ error: 'この評価を操作する権限がありません' }, { status: 403 })
    }
    if (evaluation.status === 'FINALIZED') {
      return NextResponse.json({ error: '確定済みの評価は変更できません' }, { status: 409 })
    }

    // AI使用量制限チェック
    const aiLimitError = await checkAiUsageLimit(hrCtx.organizationId)
    if (aiLimitError) {
      return NextResponse.json({ error: aiLimitError, code: 'HR_ORG_AI_LIMIT', canManageBilling: hrCtx.role === 'OWNER' }, { status: 403 })
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
      where: { id, status: { not: 'FINALIZED' }, updatedAt: evaluation.updatedAt },
      data: { aiComment },
    })

    // AI使用カウントをインクリメント
    await incrementAiUsage(hrCtx.organizationId)

    return NextResponse.json({ success: true, aiComment })
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: '生成中に評価が変更されました。再読み込みして内容を確認してください。' }, { status: 409 })
    }
    console.error('[hr/evaluations/[id]/ai-comment] unexpected error', e)
    return NextResponse.json(
      { error: 'Failed to generate AI comment' },
      { status: 500 }
    )
  }
}
