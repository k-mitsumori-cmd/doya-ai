export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { privateApiJson } from '@/lib/private-api-response'
import { runHrEvaluationMutation } from '@/lib/hr/evaluation-mutation'
import { readHrEvaluationVersionOnly, HrEvaluationInputError } from '@/lib/hr/evaluation-input'
import { HrEvaluationAiAccessError } from '@/lib/hr/evaluation-ai-access'
import { beginHrEvaluationAiOperation, completeHrEvaluationAiOperation, endHrEvaluationAiOperation, readHrEvaluationAiOperation, validHrEvaluationAiOperationId, HrEvaluationAiOperationConflict } from '@/lib/hr/evaluation-ai-operation'
import { redactEvaluationDepartment } from '@/lib/hr/evaluation-scope'
import { buildEvaluationCommentPrompt } from '@/lib/hr/prompts'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
type Ctx = { params: Promise<{ id: string; operationId: string }> }
async function handle(req: NextRequest, ctx: Ctx, method: 'GET' | 'POST' | 'DELETE') {
  let failed: (() => Promise<void>) | null = null
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    if (req.headers.get('X-HR-Organization-Id') !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const { id, operationId } = await ctx.params
    if (!id || !validHrEvaluationAiOperationId(operationId)) return privateApiJson({ error: '操作情報を確認できません。生成結果を確認してください。' }, { status: 400 })
    const ack = (result: object) => privateApiJson({ success: true, organizationId: hrCtx.organizationId, evaluationId: id, operationId, ...result })
    if (method !== 'POST') {
      const checked = await runHrEvaluationMutation(prisma, hrCtx, async tx => {
        await readHrEvaluationAiOperation(tx, hrCtx, operationId, id)
        if (method === 'DELETE') await endHrEvaluationAiOperation(tx, hrCtx, operationId, id, 'canceled')
        return readHrEvaluationAiOperation(tx, hrCtx, operationId, id)
      })
      return checked.allowed ? ack(checked.value) : privateApiJson({ error: '操作する権限が変更されています。' }, { status: 403 })
    }
    const expectedUpdatedAt = readHrEvaluationVersionOnly(await req.json().catch(() => null))
    const started = await runHrEvaluationMutation(prisma, hrCtx, tx => beginHrEvaluationAiOperation(tx, hrCtx, operationId, id, expectedUpdatedAt))
    if (!started.allowed) return privateApiJson({ error: '操作する権限が変更されています。' }, { status: 403 })
    const admission = started.value
    if (!admission.fresh) {
      if ('limit' in admission) return privateApiJson({ error: admission.limit, code: 'HR_ORG_AI_LIMIT', canManageBilling: hrCtx.role === 'OWNER' }, { status: 403 })
      return ack(admission.result)
    }
    failed = async () => {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM hr_organizations WHERE id = ${hrCtx.organizationId} FOR UPDATE`
        await endHrEvaluationAiOperation(tx, hrCtx, operationId, id, 'failed')
      }, { maxWait: 10000, timeout: 15000 })
    }
    const evaluation = admission.evaluation
    const prompt = buildEvaluationCommentPrompt({ employeeName: `${evaluation.employee.lastName} ${evaluation.employee.firstName}`, position: evaluation.employee.position,
      department: redactEvaluationDepartment(evaluation.employee, hrCtx.organizationId).department?.name, periodName: evaluation.period.name,
      goals: evaluation.goals as any, competencies: evaluation.competencies as any, selfRating: evaluation.selfRating, managerRating: evaluation.managerRating,
      selfComment: evaluation.selfComment, managerComment: evaluation.managerComment })
    const aiComment = await geminiGenerateText({ model: GEMINI_TEXT_MODEL_DEFAULT, parts: [{ text: prompt }] })
    if (typeof aiComment !== 'string' || !aiComment.trim()) throw Error('Empty AI output')
    const completed = await runHrEvaluationMutation(prisma, hrCtx, tx => completeHrEvaluationAiOperation(tx, hrCtx, operationId, id, expectedUpdatedAt, aiComment))
    if (!completed.allowed) {
      await failed(); failed = null
      return privateApiJson({ error: '生成中に権限が変更されました。保存結果を確認してください。' }, { status: 403 })
    }
    failed = null
    return ack(completed.value)
  } catch (error: unknown) {
    if (failed) {
      try { await failed() } catch { return privateApiJson({ error: '生成結果を確認できませんでした。同じ操作の記録を確認してください。' }, { status: 500 }) }
    }
    if (error instanceof HrEvaluationInputError) return privateApiJson({ error: error.message }, { status: 400 })
    if (error instanceof HrEvaluationAiAccessError) return privateApiJson({ error: error.message }, { status: error.status })
    if (error instanceof HrEvaluationAiOperationConflict) return privateApiJson({ error: '操作情報が変更されています。保存結果を確認してください。' }, { status: 409 })
    return privateApiJson({ error: '生成結果を確認できませんでした。同じ操作の記録を確認してください。' }, { status: 500 })
  }
}
export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'GET')
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'POST')
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, 'DELETE')
