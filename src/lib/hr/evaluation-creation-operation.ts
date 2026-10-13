import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { evaluationOrganizationWhere } from '@/lib/hr/evaluation-scope'
import { validHrEvaluationGoals } from '@/lib/hr/evaluation-input'

export interface HrEvaluationCreationInput {
  periodId: string; employeeId: string; evaluatorId: string | null
  goals: Prisma.InputJsonValue | null; competencies: Prisma.InputJsonValue | null
}
export type HrEvaluationCreationSnapshot = {
  id: string; periodId: string; employeeId: string; evaluatorId: string | null; status: string; updatedAt: string
}
export type HrEvaluationCreationState = { state: 'not_received' | 'canceled' | 'deleted' } | { state: 'created'; evaluation: HrEvaluationCreationSnapshot }
export class HrEvaluationCreationInputError extends Error {}
export class HrEvaluationCreationConflict extends Error {}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
export const validHrEvaluationOperationId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)

export function readHrEvaluationCreationInput(value: unknown): HrEvaluationCreationInput {
  if (!object(value) || Object.keys(value).some(key => !['periodId', 'employeeId', 'evaluatorId', 'goals', 'competencies'].includes(key)) ||
    typeof value.periodId !== 'string' || !value.periodId || typeof value.employeeId !== 'string' || !value.employeeId ||
    !(value.evaluatorId === undefined || value.evaluatorId === null || typeof value.evaluatorId === 'string') || value.evaluatorId === value.employeeId ||
    !validHrEvaluationGoals(value.goals ?? null)) throw new HrEvaluationCreationInputError()
  return { periodId: value.periodId, employeeId: value.employeeId, evaluatorId: value.evaluatorId || null,
    goals: (value.goals ?? null) as Prisma.InputJsonValue | null, competencies: (value.competencies ?? null) as Prisma.InputJsonValue | null }
}
export function readHrEvaluationCreationOperation(request: Request): { operationId: string; organizationId: string } | null | false {
  const operationId = request.headers.get('X-HR-Evaluation-Operation'), organizationId = request.headers.get('X-HR-Organization-Id')
  if (operationId === null && organizationId === null) return null
  if (!validHrEvaluationOperationId(operationId) || !organizationId) return false
  return { operationId, organizationId }
}
function key(ctx: HrContext, operationId: string) {
  return 'hr-evaluation-create-v1:' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex')
}
export function hrEvaluationCreationFingerprint(input: HrEvaluationCreationInput) {
  return createHash('sha256').update(JSON.stringify([input.periodId, input.employeeId, input.evaluatorId, input.goals, input.competencies])).digest('hex')
}
function snapshot(value: unknown): HrEvaluationCreationSnapshot {
  if (!object(value) || !['id', 'periodId', 'employeeId', 'status', 'updatedAt'].every(key => typeof value[key] === 'string' && Boolean(value[key])) ||
    !(value.evaluatorId === null || typeof value.evaluatorId === 'string') ||
    !Number.isFinite(new Date(value.updatedAt as string).getTime()) || new Date(value.updatedAt as string).toISOString() !== value.updatedAt) throw Error('Invalid evaluation receipt')
  return { id: value.id as string, periodId: value.periodId as string, employeeId: value.employeeId as string,
    evaluatorId: value.evaluatorId as string | null, status: value.status as string, updatedAt: value.updatedAt as string }
}
/** Read within the organization/member transaction. GET never persists a receipt. */
export async function readHrEvaluationCreationReceipt(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, fingerprint?: string): Promise<HrEvaluationCreationState> {
  const receipt = await tx.hrAuditLog.findUnique({ where: { id: key(ctx, operationId) } })
  if (!receipt) return { state: 'not_received' }
  const details = receipt.details
  if (receipt.organizationId !== ctx.organizationId || receipt.userId !== ctx.userId || !object(details) || details.version !== 1 || details.operationId !== operationId) throw Error('Invalid evaluation receipt')
  if (receipt.action === 'EVALUATION_CREATE_CANCELED' && details.state === 'canceled') return { state: 'canceled' }
  if (receipt.action !== 'EVALUATION_CREATED' || details.state !== 'created' || typeof details.fingerprint !== 'string') throw Error('Invalid evaluation receipt')
  if (fingerprint !== undefined && fingerprint !== details.fingerprint) throw new HrEvaluationCreationConflict()
  const evaluation = snapshot(details.evaluation)
  if (receipt.targetId !== evaluation.id) throw Error('Invalid evaluation receipt')
  const exists = await tx.hrEvaluation.findFirst({ where: { id: evaluation.id, period: { is: { organizationId: ctx.organizationId } } }, select: { id: true } })
  if (!exists) return { state: 'deleted' }
  const authorized = await tx.hrEvaluation.findFirst({ where: { id: evaluation.id, ...evaluationOrganizationWhere(ctx.organizationId) }, select: { id: true } })
  if (!authorized) throw Error('Evaluation relations changed')
  return { state: 'created', evaluation }
}
export async function saveHrEvaluationCreationReceipt(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string, fingerprint: string, evaluation: HrEvaluationCreationSnapshot) {
  const confirmed = snapshot(evaluation)
  await tx.hrAuditLog.create({ data: { id: key(ctx, operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_CREATED', target: '評価', targetId: confirmed.id,
    details: { version: 1, operationId, state: 'created', fingerprint, evaluation: confirmed } } })
}
export async function cancelHrEvaluationCreation(tx: Prisma.TransactionClient, ctx: HrContext, operationId: string): Promise<HrEvaluationCreationState> {
  const state = await readHrEvaluationCreationReceipt(tx, ctx, operationId)
  if (state.state !== 'not_received') return state
  await tx.hrAuditLog.create({ data: { id: key(ctx, operationId), organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'EVALUATION_CREATE_CANCELED', target: '評価', details: { version: 1, operationId, state: 'canceled' } } })
  return { state: 'canceled' }
}
