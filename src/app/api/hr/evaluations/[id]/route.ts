import { validHrEvaluationSaveOperationId, replayHrEvaluationSaveOperation, completeHrEvaluationSaveOperation, HrEvaluationSaveOperationConflict } from '@/lib/hr/evaluation-save-operation'
import { HrEvaluationAiAccessError } from '@/lib/hr/evaluation-ai-access'
import { Prisma } from '@prisma/client'
import { privateApiJson } from '@/lib/private-api-response'
import { runHrEvaluationMutation } from '@/lib/hr/evaluation-mutation'
import { readHrEvaluationPatch, HrEvaluationInputError, HrEvaluationWorkflowError, getHrEvaluationWorkflowData } from '@/lib/hr/evaluation-input'
import { redactEvaluationDepartment } from '@/lib/hr/evaluation-scope'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
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
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const expectedOrganization = req.headers?.get('X-HR-Organization-Id')
    if (expectedOrganization && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const p = await ctx.params
    const id = p.id

    const evaluation = await prisma.hrEvaluation.findFirst({
      where: { id },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            position: true, grade: true,
            department: { select: { id: true, name: true, organizationId: true } },
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
      return privateApiJson({ error: 'この評価は見つかりませんでした。一覧から選び直してください。' }, { status: 404 })
    }

    if (evaluation.period.organizationId !== hrCtx.organizationId) {
      return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    }

    const ratingField = await getEvaluationRatingField(hrCtx, evaluation)
    if (!ratingField) {
      return privateApiJson({ error: 'この評価を閲覧する権限がありません' }, { status: 403 })
    }

    const payload = {
      success: true,
      evaluation: {
        ...evaluation,
        employee: redactEvaluationDepartment(evaluation.employee, hrCtx.organizationId),
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
    }
    const query = new URL(req.url || 'http://localhost').searchParams
    if (query.get('format') === 'editor-packets') {
      // Lazy-load transfer hashing only for the paged editor protocol. Every page repeats live access checks above.
      const { makeHrEvaluationDetailPacket, HrDetailTransferError } = await import('@/lib/hr/evaluation-detail-transfer-server')
      try {
        return privateApiJson(makeHrEvaluationDetailPacket(payload, { actor: hrCtx.userId, organizationId: hrCtx.organizationId, evaluationId: id }, query.get('cursor')))
      } catch (error) {
        if (error instanceof HrDetailTransferError) return privateApiJson({ error: error.message }, { status: error.status })
        throw error
      }
    }
    return privateApiJson(payload)
  } catch (e: any) {
    console.error('[hr/evaluations/[id]] unexpected error')
    return privateApiJson(
      { error: '評価を読み込めませんでした。時間をおいて再読み込みしてください。' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as { id?: string } | undefined)?.id) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const hrCtx = await getHrContext()
    if (!hrCtx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    const expectedOrganization = req.headers.get('X-HR-Organization-Id')
    if (expectedOrganization && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '組織が変更されています。再取得してください。' }, { status: 403 })
    const { id } = await ctx.params
    const operationId = req.headers.get('X-HR-Evaluation-Save-Operation-Id')
    if (operationId !== null && !validHrEvaluationSaveOperationId(operationId)) return privateApiJson({ error: '保存操作の情報を確認してください。' }, { status: 400 })
    if (operationId && expectedOrganization !== hrCtx.organizationId) return privateApiJson({ error: '保存対象の組織を確認してください。' }, { status: 403 })
    const compactAck = req.headers.get('X-HR-Evaluation-Save-Response') === 'receipt-v1'
    const operationAck = (state: object) => ({ operationId, organizationId: hrCtx.organizationId, evaluationId: id, ...state })
    const body: unknown = await req.json().catch(() => null)
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
      // Prevent related employee reassignment between authorization and the write.
      const employeeIds = [...new Set([existing.employeeId, ...(existing.evaluatorId ? [existing.evaluatorId] : []), ...(hrCtx.employeeId ? [hrCtx.employeeId] : [])])].sort()
      await tx.$queryRaw`SELECT id FROM hr_employees WHERE id IN (${Prisma.join(employeeIds)}) AND "organizationId" = ${hrCtx.organizationId} ORDER BY id FOR UPDATE`
      const ratingField = await getEvaluationRatingField(hrCtx, existing, tx)
      if (!ratingField) return privateApiJson({ error: 'この評価を操作する権限がありません' }, { status: 403 })
      const input = readHrEvaluationPatch(body, existing, ratingField)
      if ('workflowAction' in input.body && !operationId) return privateApiJson({ error: '評価操作の記録を確認してください。' }, { status: 400 })
      const privilegedFields = ['evaluatorId', 'status', 'finalRating']
      const denied = ratingField === 'selfRating' ? [...privilegedFields, 'managerRating', 'managerComment'] : ratingField === 'managerRating' ? [...privilegedFields, 'selfRating', 'selfComment'] : []
      if (denied.some(field => field in input.body)) return privateApiJson({ error: 'この評価項目を変更する権限がありません' }, { status: 403 })
      if (operationId) {
        const replay = await replayHrEvaluationSaveOperation(tx, hrCtx, operationId, id, body)
        if (replay) return privateApiJson({ success: true, operation: operationAck(replay) })
      }
      if (!['DRAFT', 'SELF', 'SELF_REVIEW', 'SELF_EVALUATION', 'IN_REVIEW', 'MANAGER_REVIEW', 'SUBMITTED', 'REVIEWED', 'FINALIZED'].includes(existing.status)) return privateApiJson({ error: '評価の状態を確認できません。再取得して内容を確認してください。' }, { status: 409 })
      if (existing.status === 'FINALIZED') return privateApiJson({ error: '確定済みの評価は変更できません' }, { status: 409 })
      if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) return privateApiJson({ error: '評価が更新されています。再取得して入力内容を確認してください。', code: 'EVALUATION_CHANGED' }, { status: 409 })
      if (typeof input.body.evaluatorId === 'string') {
        await tx.$queryRaw`SELECT id FROM hr_employees WHERE id = ${input.body.evaluatorId} AND "organizationId" = ${hrCtx.organizationId} FOR UPDATE`
        if (await tx.hrEmployee.count({ where: { id: input.body.evaluatorId, organizationId: hrCtx.organizationId } }) !== 1) return privateApiJson({ error: '評価者が同じ組織に存在しません' }, { status: 400 })
      }
      const data = { ...input.data, ...getHrEvaluationWorkflowData(existing, ratingField, input.body) }
      for (const field of ['goals', 'competencies'] as const) if (field in input.body) data[field] = input.body[field] === null ? Prisma.DbNull : input.body[field] as Prisma.InputJsonValue
      data.updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1))
      const changed = await tx.hrEvaluation.updateMany({ where: { id, updatedAt: input.expectedUpdatedAt, status: { not: 'FINALIZED' } }, data })
      if (changed.count !== 1) return privateApiJson({ error: '評価が変更されています。再取得してください。' }, { status: 409 })
      const updated = await tx.hrEvaluation.findUniqueOrThrow({ where: { id } })
      if (operationId) await completeHrEvaluationSaveOperation(tx, hrCtx, operationId, id, body, input.expectedUpdatedAt, updated.updatedAt)
      if (operationId && compactAck) return privateApiJson({ success: true, operation: operationAck({ state: 'completed', updatedAt: updated.updatedAt.toISOString() }) })
      return privateApiJson({ success: true, ...(operationId ? { operation: operationAck({ state: 'completed', updatedAt: updated.updatedAt.toISOString() }) } : {}), evaluation: { ...updated, ratingField, overallScore: updated[ratingField] ?? 0, isManager: ratingField !== 'selfRating' } })
    })
    return result.allowed ? result.value : privateApiJson({ error: '評価を更新する権限が変更されています。' }, { status: 403 })
  } catch (error: unknown) {
    if (error instanceof HrEvaluationSaveOperationConflict) return privateApiJson({ error: '保存操作の内容が変更されています。操作結果を確認してください。' }, { status: 409 })
    if (error instanceof HrEvaluationAiAccessError) return privateApiJson({ error: error.message }, { status: error.status })
    if (error instanceof HrEvaluationWorkflowError) return privateApiJson({ error: error.message }, { status: error.status })
    if (error instanceof HrEvaluationInputError) return privateApiJson({ error: error.message }, { status: 400 })
    console.error('[hr/evaluations/[id]][PATCH] failed')
    return privateApiJson({ error: '評価を保存できませんでした。時間をおいて、もう一度お試しください。' }, { status: 500 })
  }
}
