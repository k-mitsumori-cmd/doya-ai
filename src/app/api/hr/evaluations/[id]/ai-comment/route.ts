export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { redactEvaluationDepartment } from '@/lib/hr/evaluation-scope'
import { privateApiJson } from '@/lib/private-api-response'
import { readHrEvaluationVersionOnly, HrEvaluationInputError } from '@/lib/hr/evaluation-input'
import { runHrEvaluationMutation } from '@/lib/hr/evaluation-mutation'
import { readHrEvaluationForAi, HrEvaluationAiAccessError } from '@/lib/hr/evaluation-ai-access'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildEvaluationCommentPrompt } from '@/lib/hr/prompts'
import { reserveAiUsageInTransaction, releaseAiUsage } from '@/lib/hr/billing'
type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const organization = req.headers.get('X-HR-Organization-Id')
    if (organization && organization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const { id } = await ctx.params
    const expectedUpdatedAt = readHrEvaluationVersionOnly(await req.json().catch(() => null))
    const prepared = await runHrEvaluationMutation(prisma, hrCtx, async tx => {
      const evaluation = await readHrEvaluationForAi(tx, hrCtx, id, expectedUpdatedAt)
      const prompt = buildEvaluationCommentPrompt({
        employeeName: `${evaluation.employee.lastName} ${evaluation.employee.firstName}`,
        position: evaluation.employee.position,
        department: redactEvaluationDepartment(evaluation.employee, hrCtx.organizationId).department?.name,
        periodName: evaluation.period.name, goals: evaluation.goals as any, competencies: evaluation.competencies as any,
        selfRating: evaluation.selfRating, managerRating: evaluation.managerRating,
        selfComment: evaluation.selfComment, managerComment: evaluation.managerComment,
      })
      const admission = await reserveAiUsageInTransaction(tx, hrCtx.organizationId)
      return { prompt, admission }
    })
    if (!prepared.allowed) return privateApiJson({ error: '生成する権限が変更されています。' }, { status: 403 })
    const { admission, prompt } = prepared.value
    if (!admission.granted) return privateApiJson({ error: admission.error, code: 'HR_ORG_AI_LIMIT', canManageBilling: hrCtx.role === 'OWNER' }, { status: 403 })
    let saved = false
    try {
      const aiComment = await geminiGenerateText({ model: GEMINI_TEXT_MODEL_DEFAULT, parts: [{ text: prompt }] })
      if (typeof aiComment !== 'string' || !aiComment.trim()) throw Error('Empty AI comment')
      const persisted = await runHrEvaluationMutation(prisma, hrCtx, async tx => {
        const current = await readHrEvaluationForAi(tx, hrCtx, id, expectedUpdatedAt)
        const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1))
        const changed = await tx.hrEvaluation.updateMany({ where: { id, updatedAt: expectedUpdatedAt, status: { not: 'FINALIZED' } }, data: { aiComment, updatedAt } })
        if (changed.count !== 1) throw new HrEvaluationAiAccessError(409, '生成中に評価が変更されました。再取得してください。')
        return updatedAt
      })
      if (!persisted.allowed) return privateApiJson({ error: '生成中に権限が変更されました。保存結果を確認してください。' }, { status: 403 })
      saved = true
      return privateApiJson({ success: true, aiComment, evaluationId: id, organizationId: hrCtx.organizationId, updatedAt: persisted.value.toISOString() })
    } finally {
      if (!saved) await releaseAiUsage(admission.reservation)
    }
  } catch (error: unknown) {
    if (error instanceof HrEvaluationInputError) return privateApiJson({ error: error.message }, { status: 400 })
    if (error instanceof HrEvaluationAiAccessError) return privateApiJson({ error: error.message }, { status: error.status })
    console.error('[hr/evaluations/[id]/ai-comment] failed')
    return privateApiJson({ error: 'AIコメントの処理結果を確認できませんでした。保存内容を再確認してください。' }, { status: 500 })
  }
}
