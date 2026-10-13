import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { reserveAiUsageInTransaction } from '@/lib/hr/billing'
import { readHrEvaluationForAi } from '@/lib/hr/evaluation-ai-access'
export class HrEvaluationAiOperationConflict extends Error {}
type Receipt = { version: 1; operationId: string; evaluationId: string; expectedUpdatedAt: string | null; state: 'processing' | 'completed' | 'failed' | 'canceled'; resetAt: string | null; updatedAt: string | null }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
export const validHrEvaluationAiOperationId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
function key(ctx: HrContext, operationId: string) { return 'hr-evaluation-ai-v1:' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex') }
async function receipt(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string): Promise<Receipt | null> {
  const row = await tx.hrAuditLog.findUnique({ where: { id: key(ctx, operationId) } })
  if (!row) return null
  const value = row.details
  if (row.organizationId !== ctx.organizationId || row.userId !== ctx.userId || row.action !== 'EVALUATION_AI_OPERATION' || !object(value) || value.version !== 1 || value.operationId !== operationId ||
    !['processing', 'completed', 'failed', 'canceled'].includes(value.state as string) || !(value.expectedUpdatedAt === null || iso(value.expectedUpdatedAt)) ||
    !(value.resetAt === null || iso(value.resetAt)) || !(value.updatedAt === null || iso(value.updatedAt)) || value.evaluationId !== row.targetId) throw Error('Invalid AI operation receipt')
  if (value.evaluationId !== evaluationId) throw new HrEvaluationAiOperationConflict()
  if (value.state === 'processing' && (!iso(value.expectedUpdatedAt) || !iso(value.resetAt) || value.updatedAt !== null) ||
    value.state === 'completed' && (!iso(value.updatedAt) || !iso(value.expectedUpdatedAt) || !iso(value.resetAt))) throw Error('Invalid AI operation receipt')
  return value as Receipt
}
async function put(tx: Prisma.TransactionClient, ctx: HrContext, value: Receipt, create: boolean) {
  const details = { ...value }
  if (create) await tx.hrAuditLog.create({ data: { id: key(ctx, value.operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_AI_OPERATION', target: 'Evaluation AI', targetId: value.evaluationId, details } })
  else await tx.hrAuditLog.update({ where: { id: key(ctx, value.operationId) }, data: { details } })
}
/** Caller holds organization/live-member locks. This read never mutates receipt or quota. */
export async function readHrEvaluationAiOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string) {
  const value = await receipt(tx, ctx, operationId, evaluationId)
  if (!value) {
    await readHrEvaluationForAi(tx, ctx, evaluationId, null)
    return { state: 'not_received' as const }
  }
  const exists = await tx.hrEvaluation.findUnique({ where: { id: evaluationId }, select: { id: true } })
  if (!exists) return { state: 'deleted' as const }
  const evaluation = await readHrEvaluationForAi(tx, ctx, evaluationId, null)
  if (value.state !== 'completed') return { state: value.state }
  if (evaluation.updatedAt.toISOString() !== value.updatedAt) return { state: 'superseded' as const }
  if (typeof evaluation.aiComment !== 'string' || !evaluation.aiComment.trim()) throw Error('Missing completed AI output')
  return { state: 'completed' as const, updatedAt: value.updatedAt, aiComment: evaluation.aiComment }
}
/** One durable receipt and quota reservation, committed before the provider can run. */
export async function beginHrEvaluationAiOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string, expectedUpdatedAt: Date) {
  const old = await receipt(tx, ctx, operationId, evaluationId)
  if (old) {
    if (old.expectedUpdatedAt !== null && old.expectedUpdatedAt !== expectedUpdatedAt.toISOString()) throw new HrEvaluationAiOperationConflict()
    return { fresh: false as const, result: await readHrEvaluationAiOperation(tx, ctx, operationId, evaluationId) }
  }
  const evaluation = await readHrEvaluationForAi(tx, ctx, evaluationId, expectedUpdatedAt)
  const admission = await reserveAiUsageInTransaction(tx, ctx.organizationId)
  if (!admission.granted) return { fresh: false as const, limit: admission.error }
  await put(tx, ctx, { version: 1, operationId, evaluationId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), state: 'processing', resetAt: admission.reservation.resetAt.toISOString(), updatedAt: null }, true)
  return { fresh: true as const, evaluation }
}
/** Finish row update and receipt in the same transaction; cancellation fences late output. */
export async function completeHrEvaluationAiOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string, expectedUpdatedAt: Date, aiComment: string) {
  const value = await receipt(tx, ctx, operationId, evaluationId)
  if (!value || value.state !== 'processing' || value.expectedUpdatedAt !== expectedUpdatedAt.toISOString()) throw new HrEvaluationAiOperationConflict()
  const current = await readHrEvaluationForAi(tx, ctx, evaluationId, expectedUpdatedAt)
  const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1))
  const changed = await tx.hrEvaluation.updateMany({ where: { id: evaluationId, updatedAt: expectedUpdatedAt, status: { not: 'FINALIZED' } }, data: { aiComment, updatedAt } })
  if (changed.count !== 1) throw new HrEvaluationAiOperationConflict()
  await put(tx, ctx, { ...value, state: 'completed', updatedAt: updatedAt.toISOString() }, false)
  return { state: 'completed' as const, updatedAt: updatedAt.toISOString(), aiComment }
}
/** Caller holds organization lock. One terminal transition owns the refund, even after membership loss. */
export async function endHrEvaluationAiOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string, state: 'failed' | 'canceled') {
  const value = await receipt(tx, ctx, operationId, evaluationId)
  if (value?.state !== 'processing') {
    if (!value && state === 'canceled') await put(tx, ctx, { version: 1, operationId, evaluationId, expectedUpdatedAt: null, state, resetAt: null, updatedAt: null }, true)
    return
  }
  await tx.hrOrganization.updateMany({ where: { id: ctx.organizationId, aiUsageResetAt: new Date(value.resetAt!), aiUsageCount: { gt: 0 } }, data: { aiUsageCount: { decrement: 1 } } })
  await put(tx, ctx, { ...value, state }, false)
}
