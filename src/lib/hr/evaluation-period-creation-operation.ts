import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import type { readHrEvaluationPeriodCreate } from '@/lib/hr/evaluation-period-input'

export class HrEvaluationPeriodCreationConflict extends Error {}
type Input = ReturnType<typeof readHrEvaluationPeriodCreate>
type Snapshot = { id: string; organizationId: string; status: string; createdAt: string; updatedAt: string }
export type HrEvaluationPeriodCreationState =
  | { state: 'not_received' | 'canceled' | 'deleted' }
  | { state: 'created'; period: Snapshot; fingerprint: string }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export const validHrEvaluationPeriodCreationId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const key = (ctx: HrContext, operationId: string) => 'hr-evaluation-period-create-v1:' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex')
function canonical(value: unknown): string {
  const output: string[] = [], pending: ({ value: unknown } | { token: string })[] = [{ value }]
  while (pending.length) {
    const item = pending.pop()!
    if ('token' in item) { output.push(item.token); continue }
    const current = item.value
    if (Array.isArray(current)) {
      output.push('['); pending.push({ token: ']' })
      for (let i = current.length - 1; i >= 0; i--) {
        pending.push({ value: current[i] })
        if (i > 0) pending.push({ token: ',' })
      }
    } else if (object(current)) {
      output.push('{'); pending.push({ token: '}' })
      const keys = Object.keys(current).sort()
      for (let i = keys.length - 1; i >= 0; i--) {
        pending.push({ value: current[keys[i]] }, { token: ':' }, { token: JSON.stringify(keys[i]) })
        if (i > 0) pending.push({ token: ',' })
      }
    } else {
      const encoded = JSON.stringify(current)
      if (encoded === undefined) throw new HrEvaluationPeriodCreationConflict()
      output.push(encoded)
    }
  }
  return output.join('')
}
export function hrEvaluationPeriodCreationFingerprint(input: Input) {
  return createHash('sha256').update(canonical({ name: input.name, startDate: input.startDate.toISOString(), endDate: input.endDate.toISOString(), status: input.status, evaluationTemplate: input.evaluationTemplate ?? null })).digest('hex')
}
function snapshot(value: unknown, organizationId: string): Snapshot {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'createdAt,id,organizationId,status,updatedAt' ||
    typeof value.id !== 'string' || !value.id || value.organizationId !== organizationId ||
    !['DRAFT', 'OPEN', 'IN_REVIEW', 'CLOSED'].includes(value.status as string) || !iso(value.createdAt) || !iso(value.updatedAt) || value.createdAt > value.updatedAt) throw new HrEvaluationPeriodCreationConflict()
  return value as Snapshot
}
/** Caller holds the organization and current administrator membership locks. Reads never write receipts. */
export async function readHrEvaluationPeriodCreation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, fingerprint?: string): Promise<HrEvaluationPeriodCreationState> {
  const row = await tx.hrAuditLog.findUnique({ where: { id: key(ctx, operationId) } })
  if (!row) return { state: 'not_received' }
  const value = row.details
  if (row.organizationId !== ctx.organizationId || row.userId !== ctx.userId || row.action !== 'EVALUATION_PERIOD_CREATION' ||
    !object(value) || value.version !== 1 || value.operationId !== operationId) throw new HrEvaluationPeriodCreationConflict()
  if (value.state === 'canceled') {
    if (Object.keys(value).sort().join(',') !== 'operationId,state,version' || row.targetId !== null) throw new HrEvaluationPeriodCreationConflict()
    return { state: 'canceled' }
  }
  if (value.state !== 'created' || Object.keys(value).sort().join(',') !== 'fingerprint,operationId,period,state,version' || !hash(value.fingerprint)) throw new HrEvaluationPeriodCreationConflict()
  if (fingerprint !== undefined && value.fingerprint !== fingerprint) throw new HrEvaluationPeriodCreationConflict()
  const period = snapshot(value.period, ctx.organizationId)
  if (row.targetId !== period.id) throw new HrEvaluationPeriodCreationConflict()
  const current = await tx.hrEvaluationPeriod.findUnique({ where: { id: period.id }, select: { organizationId: true } })
  if (!current) return { state: 'deleted' }
  if (current.organizationId !== ctx.organizationId) throw new HrEvaluationPeriodCreationConflict()
  return { state: 'created', period, fingerprint: value.fingerprint }
}
/** Must share a transaction with domain creation. No name, template or request body is retained. */
export async function saveHrEvaluationPeriodCreation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, fingerprint: string, value: Snapshot) {
  const period = snapshot(value, ctx.organizationId)
  if (!hash(fingerprint)) throw new HrEvaluationPeriodCreationConflict()
  await tx.hrAuditLog.create({ data: { id: key(ctx, operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_PERIOD_CREATION', target: '評価期間作成', targetId: period.id,
    details: { version: 1, operationId, state: 'created', fingerprint, period } } })
}
/** A persistent cancellation fence serializes with queued POSTs through the same organization lock. */
export async function cancelHrEvaluationPeriodCreation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string): Promise<HrEvaluationPeriodCreationState> {
  const current = await readHrEvaluationPeriodCreation(tx, ctx, operationId)
  if (current.state !== 'not_received') return current
  await tx.hrAuditLog.create({ data: { id: key(ctx, operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_PERIOD_CREATION', target: '評価期間作成',
    details: { version: 1, operationId, state: 'canceled' } } })
  return { state: 'canceled' }
}
