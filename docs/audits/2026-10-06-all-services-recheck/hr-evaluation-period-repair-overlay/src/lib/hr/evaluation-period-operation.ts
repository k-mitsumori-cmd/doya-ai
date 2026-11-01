import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'

export class HrEvaluationPeriodOperationAccessError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

export class HrEvaluationPeriodOperationConflict extends Error {}
type Receipt = { version: 1; operationId: string; periodId: string; state: 'completed' | 'canceled'; fingerprint: string | null; expectedUpdatedAt: string | null; updatedAt: string | null }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
export const validHrEvaluationPeriodOperationId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const key = (ctx: HrContext, operationId: string) => 'hr-evaluation-period-v1:' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex')
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new HrEvaluationPeriodOperationConflict()
  return encoded
}
const fingerprint = (body: unknown) => createHash('sha256').update(canonical(body)).digest('hex')
async function receipt(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, periodId: string): Promise<Receipt | null> {
  const row = await tx.hrAuditLog.findUnique({ where: { id: key(ctx, operationId) } })
  if (!row) return null
  const value = row.details
  if (row.organizationId !== ctx.organizationId || row.userId !== ctx.userId || row.targetId !== periodId || row.action !== 'EVALUATION_PERIOD_OPERATION' ||
    !object(value) || value.version !== 1 || value.operationId !== operationId || value.periodId !== periodId ||
    Object.keys(value).some(k => !['version', 'operationId', 'periodId', 'state', 'fingerprint', 'expectedUpdatedAt', 'updatedAt'].includes(k)) ||
    !(value.state === 'canceled' && value.fingerprint === null && value.expectedUpdatedAt === null && value.updatedAt === null ||
      value.state === 'completed' && typeof value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(value.fingerprint) && iso(value.expectedUpdatedAt) && iso(value.updatedAt) && new Date(value.updatedAt).getTime() > new Date(value.expectedUpdatedAt).getTime())) throw new HrEvaluationPeriodOperationConflict()
  return value as Receipt
}
async function put(tx: Prisma.TransactionClient, ctx: HrContext, value: Receipt) {
  await tx.hrAuditLog.create({ data: { id: key(ctx, value.operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_PERIOD_OPERATION', target: 'Evaluation period change', targetId: value.periodId, details: { ...value } } })
}
/** Caller holds the organization and live-member locks. No period names, templates or request bodies are retained in the receipt. */
export async function readHrEvaluationPeriodOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, periodId: string) {
  const value = await receipt(tx, ctx, operationId, periodId)
  const period = await tx.hrEvaluationPeriod.findUnique({ where: { id: periodId }, select: { organizationId: true, updatedAt: true } })
  if (!period && value) return { state: 'deleted' as const }
  if (!period) throw new HrEvaluationPeriodOperationAccessError('評価期間が見つかりません。', 404)
  if (period.organizationId !== ctx.organizationId) throw new HrEvaluationPeriodOperationAccessError('この評価期間を確認する権限がありません。', 403)
  if (!value) return { state: 'not_received' as const }
  if (value.state === 'canceled') return { state: 'canceled' as const }
  return period.updatedAt.toISOString() === value.updatedAt
    ? { state: 'completed' as const, updatedAt: value.updatedAt! }
    : { state: 'superseded' as const }
}
/** Validate immutable input before returning an existing result; a canceled-before-send fence cannot write. */
export async function replayHrEvaluationPeriodOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, periodId: string, body: unknown) {
  const value = await receipt(tx, ctx, operationId, periodId)
  if (!value) return null
  if (value.state === 'completed' && value.fingerprint !== fingerprint(body)) throw new HrEvaluationPeriodOperationConflict()
  return readHrEvaluationPeriodOperation(tx, ctx, operationId, periodId)
}
/** Must run in the same transaction as the period update so receipt failure rolls back the write. */
export async function completeHrEvaluationPeriodOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, periodId: string, body: unknown, expectedUpdatedAt: Date, updatedAt: Date) {
  await put(tx, ctx, { version: 1, operationId, periodId, state: 'completed', fingerprint: fingerprint(body), expectedUpdatedAt: expectedUpdatedAt.toISOString(), updatedAt: updatedAt.toISOString() })
}
/** Organization locking serializes the cancellation fence with a queued/in-flight PATCH. */
export async function endHrEvaluationPeriodOperation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, periodId: string) {
  const value = await receipt(tx, ctx, operationId, periodId)
  await readHrEvaluationPeriodOperation(tx, ctx, operationId, periodId)
  if (!value) await put(tx, ctx, { version: 1, operationId, periodId, state: 'canceled', fingerprint: null, expectedUpdatedAt: null, updatedAt: null })
  return readHrEvaluationPeriodOperation(tx, ctx, operationId, periodId)
}
