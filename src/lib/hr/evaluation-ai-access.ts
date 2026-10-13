import { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { canReadEvaluation, getEvaluationRatingField } from '@/lib/hr/evaluation-access'
import { assertHrEvaluationEditable, HrEvaluationWorkflowError } from '@/lib/hr/evaluation-input'
export class HrEvaluationAiAccessError extends Error {
  constructor(readonly status: 403 | 404 | 409, message: string) { super(message) }
}
/** Caller holds organization/live-member locks. Lock related rows before reading provider input or persisting output. */
export async function readHrEvaluationForAi(tx: Prisma.TransactionClient, ctx: HrContext, id: string, expectedUpdatedAt: Date | null) {
  // Lock only records whose complete evaluation scope belongs to this organization.
  // Foreign IDs must be rejected without waiting on or locking another tenant's rows.
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT e.id FROM hr_evaluations e
    JOIN hr_evaluation_periods p ON p.id = e."periodId"
    JOIN hr_employees target ON target.id = e."employeeId"
    LEFT JOIN hr_employees reviewer ON reviewer.id = e."evaluatorId"
    WHERE e.id = ${id} AND p."organizationId" = ${ctx.organizationId}
      AND target."organizationId" = ${ctx.organizationId}
      AND (e."evaluatorId" IS NULL OR reviewer."organizationId" = ${ctx.organizationId})
    FOR UPDATE OF e
  `
  const identity = await tx.hrEvaluation.findUnique({ where: { id }, select: { employeeId: true, evaluatorId: true, periodId: true } })
  if (!identity) throw new HrEvaluationAiAccessError(404, '評価が見つかりません。')
  if (locked.length !== 1) throw new HrEvaluationAiAccessError(403, 'この評価を操作する権限がありません。')
  await tx.$queryRaw`SELECT id FROM hr_evaluation_periods WHERE id = ${identity.periodId} FOR UPDATE`
  const employees = [...new Set([identity.employeeId, ...(identity.evaluatorId ? [identity.evaluatorId] : []), ...(ctx.employeeId ? [ctx.employeeId] : [])])].sort()
  await tx.$queryRaw`SELECT id FROM hr_employees WHERE id IN (${Prisma.join(employees)}) AND "organizationId" = ${ctx.organizationId} ORDER BY id FOR UPDATE`
  const evaluation = await tx.hrEvaluation.findUniqueOrThrow({ where: { id }, include: {
    employee: { select: { firstName: true, lastName: true, position: true, department: { select: { name: true, organizationId: true } } } },
    period: { select: { name: true, organizationId: true } },
  } })
  if (evaluation.period.organizationId !== ctx.organizationId || !await canReadEvaluation(ctx, evaluation, tx)) throw new HrEvaluationAiAccessError(403, 'この評価を操作する権限がありません。')
  if (expectedUpdatedAt === null) return evaluation
  try {
    assertHrEvaluationEditable(evaluation.status, await getEvaluationRatingField(ctx, evaluation, tx))
  } catch (error) {
    if (error instanceof HrEvaluationWorkflowError) throw new HrEvaluationAiAccessError(error.status, error.message)
    throw error
  }
  if (!['DRAFT', 'SELF', 'SELF_REVIEW', 'SELF_EVALUATION', 'IN_REVIEW', 'MANAGER_REVIEW', 'SUBMITTED', 'REVIEWED', 'FINALIZED'].includes(evaluation.status)) throw new HrEvaluationAiAccessError(409, '評価の状態を確認できません。再取得して内容を確認してください。')
  if (evaluation.status === 'FINALIZED') throw new HrEvaluationAiAccessError(409, '確定済みの評価は変更できません。')
  if (evaluation.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new HrEvaluationAiAccessError(409, '評価が更新されています。再取得して内容を確認してください。')
  return evaluation
}
