export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { getEvaluationRatingField } from '@/lib/hr/evaluation-access'
import { privateApiJson } from '@/lib/private-api-response'
import { runHrEvaluationMutation } from '@/lib/hr/evaluation-mutation'
import { readHrEvaluationVersionOnly, HrEvaluationInputError, HrEvaluationWorkflowError, resolveHrEvaluationSubmit, getHrEvaluationWorkflowData } from '@/lib/hr/evaluation-input'
type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    if (expectedOrganization && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const { id } = await ctx.params
    const expectedUpdatedAt = readHrEvaluationVersionOnly(await req.json().catch(() => null))
    const result = await runHrEvaluationMutation(prisma, hrCtx, async tx => {
      await tx.$queryRaw`
    SELECT e.id FROM hr_evaluations e
    JOIN hr_evaluation_periods p ON p.id = e."periodId"
    JOIN hr_employees target ON target.id = e."employeeId"
    LEFT JOIN hr_employees reviewer ON reviewer.id = e."evaluatorId"
    WHERE e.id = ${id} AND p."organizationId" = ${hrCtx.organizationId}
      AND target."organizationId" = ${hrCtx.organizationId}
      AND (e."evaluatorId" IS NULL OR reviewer."organizationId" = ${hrCtx.organizationId})
    FOR UPDATE OF e
  `
      const existing = await tx.hrEvaluation.findFirst({ where: { id }, include: { period: { select: { organizationId: true } } } })
      if (!existing) return privateApiJson({ error: 'この評価は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
      if (existing.period.organizationId !== hrCtx.organizationId) return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
      const employeeIds = [...new Set([existing.employeeId, ...(existing.evaluatorId ? [existing.evaluatorId] : []), ...(hrCtx.employeeId ? [hrCtx.employeeId] : [])])].sort()
      await tx.$queryRaw`SELECT id FROM hr_employees WHERE id IN (${Prisma.join(employeeIds)}) AND "organizationId" = ${hrCtx.organizationId} ORDER BY id FOR UPDATE`
      const ratingField = await getEvaluationRatingField(hrCtx, existing, tx)
      if (!ratingField) return privateApiJson({ error: 'この評価を操作する権限がありません' }, { status: 403 })
      if (!['DRAFT', 'SELF', 'SELF_REVIEW', 'SELF_EVALUATION', 'IN_REVIEW', 'MANAGER_REVIEW', 'SUBMITTED', 'REVIEWED', 'FINALIZED'].includes(existing.status)) return privateApiJson({ error: '評価の状態を確認できません。再取得して内容を確認してください。' }, { status: 409 })
      if (existing.status === 'FINALIZED') return privateApiJson({ error: '確定済みの評価は提出できません' }, { status: 409 })
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return privateApiJson({ error: '評価が更新されています。再取得してから提出してください。', code: 'EVALUATION_CHANGED' }, { status: 409 })
      const targetStatus = resolveHrEvaluationSubmit(existing.status, ratingField)
      const workflowData = getHrEvaluationWorkflowData(existing, ratingField, { workflowAction: targetStatus === 'REVIEWED' ? 'review' : 'submit' })
      const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1))
      const changed = await tx.hrEvaluation.updateMany({ where: { id, updatedAt: expectedUpdatedAt, status: { not: 'FINALIZED' } }, data: { ...workflowData, updatedAt } })
      if (changed.count !== 1) return privateApiJson({ error: '評価が変更されています。再取得してください。' }, { status: 409 })
      const updated = await tx.hrEvaluation.findUniqueOrThrow({ where: { id } })
      return privateApiJson({ success: true, evaluation: updated })
    })
    return result.allowed ? result.value : privateApiJson({ error: '提出する権限が変更されています。' }, { status: 403 })
  } catch (error: unknown) {
    if (error instanceof HrEvaluationWorkflowError) return privateApiJson({ error: error.message }, { status: error.status })
    if (error instanceof HrEvaluationInputError) return privateApiJson({ error: error.message }, { status: 400 })
    console.error('[hr/evaluations/[id]/submit] failed')
    return privateApiJson({ error: '評価を提出できませんでした。時間をおいて、もう一度お試しください。' }, { status: 500 })
  }
}
