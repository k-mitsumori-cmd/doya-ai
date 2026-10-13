import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { readHrEvaluationForAi } from '@/lib/hr/evaluation-ai-access'

export class HrEvaluationSaveOperationConflict extends Error {}
type Receipt = { version: 1; operationId: string; evaluationId: string; state: 'completed' | 'canceled'; fingerprint: string | null; expectedUpdatedAt: string | null; updatedAt: string | null }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
export const validHrEvaluationSaveOperationId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const key = (ctx: HrContext, operationId: string) => 'hr-evaluation-save-v1:' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex')
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new HrEvaluationSaveOperationConflict()
  return encoded
}
const fingerprint = (body: unknown) => createHash('sha256').update(canonical(body)).digest('hex')
async function receipt(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string): Promise<Receipt | null> {
  const row = await tx.hrAuditLog.findUnique({ where: { id: key(ctx, operationId) } })
  if (!row) return null
  const value = row.details
  if (row.organizationId !== ctx.organizationId || row.userId !== ctx.userId || row.targetId !== evaluationId || row.action !== 'EVALUATION_SAVE_OPERATION' ||
    !object(value) || value.version !== 1 || value.operationId !== operationId || value.evaluationId !== evaluationId ||
    Object.keys(value).some(k => !['version', 'operationId', 'evaluationId', 'state', 'fingerprint', 'expectedUpdatedAt', 'updatedAt'].includes(k)) ||
    !(value.state === 'canceled' && value.fingerprint === null && value.expectedUpdatedAt === null && value.updatedAt === null ||
      value.state === 'completed' && typeof value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(value.fingerprint) && iso(value.expectedUpdatedAt) && iso(value.updatedAt) && new Date(value.updatedAt).getTime() > new Date(value.expectedUpdatedAt).getTime())) throw new HrEvaluationSaveOperationConflict()
  return value as Receipt
}
async function put(tx: Prisma.TransactionClient, ctx: HrContext, value: Receipt) {
  await tx.hrAuditLog.create({ data: { id: key(ctx, value.operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_SAVE_OPERATION', target: 'Evaluation save', targetId: value.evaluationId, details: { ...value } } })
}
/** Caller holds the organization and live-member locks. No comments or goals are retained in the receipt. */
export async function readHrEvaluationSaveOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string) {
  const value = await receipt(tx, ctx, operationId, evaluationId)
  const exists = await tx.hrEvaluation.findUnique({ where: { id: evaluationId }, select: { id: true } })
  if (!exists && value) return { state: 'deleted' as const }
  // The null-version mode checks current read authority, including related employee organization boundaries.
  const evaluation = await readHrEvaluationForAi(tx, ctx, evaluationId, null)
  if (!value) return { state: 'not_received' as const }
  if (value.state === 'canceled') return { state: 'canceled' as const }
  return evaluation.updatedAt.toISOString() === value.updatedAt
    ? { state: 'completed' as const, updatedAt: value.updatedAt! }
    : { state: 'superseded' as const }
}
/** Validate immutable input before returning an existing result; a canceled-before-send fence cannot write. */
export async function replayHrEvaluationSaveOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string, body: unknown) {
  const value = await receipt(tx, ctx, operationId, evaluationId)
  if (!value) return null
  if (value.state === 'completed' && value.fingerprint !== fingerprint(body)) throw new HrEvaluationSaveOperationConflict()
  return readHrEvaluationSaveOperation(tx, ctx, operationId, evaluationId)
}
/** Must run in the same transaction as the evaluation update so receipt failure rolls back the write. */
export async function completeHrEvaluationSaveOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string, body: unknown, expectedUpdatedAt: Date, updatedAt: Date) {
  await put(tx, ctx, { version: 1, operationId, evaluationId, state: 'completed', fingerprint: fingerprint(body), expectedUpdatedAt: expectedUpdatedAt.toISOString(), updatedAt: updatedAt.toISOString() })
}
/** Organization locking serializes the cancellation fence with a queued/in-flight PATCH. */
export async function endHrEvaluationSaveOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, evaluationId: string) {
  const value = await receipt(tx, ctx, operationId, evaluationId)
  await readHrEvaluationSaveOperation(tx, ctx, operationId, evaluationId)
  if (!value) await put(tx, ctx, { version: 1, operationId, evaluationId, state: 'canceled', fingerprint: null, expectedUpdatedAt: null, updatedAt: null })
  return readHrEvaluationSaveOperation(tx, ctx, operationId, evaluationId)
}
