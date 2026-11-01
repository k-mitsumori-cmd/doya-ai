import type { Prisma } from '@prisma/client'
import type { EvaluationRatingField } from '@/lib/hr/evaluation-access'
export class HrEvaluationInputError extends Error {}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalid = (): never => { throw new HrEvaluationInputError('評価の更新内容を確認してください。最新の状態を再取得してから入力してください。') }
export function readHrEvaluationExpectedVersion(value: unknown): Date {
  if (typeof value !== 'string') return invalid()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) return invalid()
  return date
}
export function readHrEvaluationVersionOnly(value: unknown) {
  if (!object(value) || Object.keys(value).join(',') !== 'expectedUpdatedAt') return invalid()
  return readHrEvaluationExpectedVersion(value.expectedUpdatedAt)
}
export function validHrEvaluationGoals(value: unknown): boolean {
  if (value === null) return true
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  return value.every(goal => {
    if (!object(goal) || typeof goal.id !== 'string' || !goal.id || ids.has(goal.id) || typeof goal.title !== 'string') return false
    ids.add(goal.id)
    for (const field of ['description', 'result']) if (field in goal && typeof goal[field] !== 'string') return false
    if ('weight' in goal && (typeof goal.weight !== 'number' || !Number.isFinite(goal.weight) || goal.weight < 0 || goal.weight > 100)) return false
    if ('score' in goal && (typeof goal.score !== 'number' || !Number.isInteger(goal.score) || goal.score < 0 || goal.score > 5)) return false
    return true
  })
}
export function readHrEvaluationPatch(value: unknown, evaluation: { id: string; employeeId: string }, ratingField: EvaluationRatingField) {
  const allowed = ['expectedUpdatedAt', 'evaluationId', 'employeeId', 'evaluatorId', 'goals', 'competencies', 'selfRating', 'managerRating', 'finalRating', 'selfComment', 'managerComment', 'status', 'overallScore', 'workflowAction']
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key)) ||
    'evaluationId' in value && value.evaluationId !== evaluation.id || 'employeeId' in value && value.employeeId !== evaluation.employeeId) return invalid()
  const expectedUpdatedAt = readHrEvaluationExpectedVersion(value.expectedUpdatedAt)
  if ('workflowAction' in value && (!['submit', 'review', 'finalize'].includes(value.workflowAction as string) || Object.keys(value).some(key => !['expectedUpdatedAt', 'workflowAction'].includes(key)))) return invalid()
  for (const field of ['selfRating', 'managerRating', 'finalRating', 'overallScore']) {
    const score = value[field]
    if (field in value && score !== null && (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 5)) return invalid()
  }
  if ('overallScore' in value && ratingField in value && (value.overallScore === 0 ? null : value.overallScore) !== value[ratingField]) return invalid()
  for (const field of ['selfComment', 'managerComment']) if (field in value && value[field] !== null && typeof value[field] !== 'string') return invalid()
  if ('evaluatorId' in value && value.evaluatorId !== null && (typeof value.evaluatorId !== 'string' || !value.evaluatorId || value.evaluatorId === evaluation.employeeId)) return invalid()
  if ('status' in value && (typeof value.status !== 'string' || !['DRAFT', 'SELF', 'SELF_REVIEW', 'SELF_EVALUATION', 'IN_REVIEW', 'MANAGER_REVIEW', 'SUBMITTED', 'REVIEWED', 'FINALIZED'].includes(value.status))) return invalid()
  if ('goals' in value && !validHrEvaluationGoals(value.goals)) return invalid()
  const data: Prisma.HrEvaluationUncheckedUpdateManyInput = {}
  for (const field of ['evaluatorId', 'selfRating', 'managerRating', 'finalRating', 'selfComment', 'managerComment', 'status'] as const) {
    if (field in value) Object.assign(data, { [field]: value[field] })
  }
  if ('overallScore' in value) Object.assign(data, { [ratingField]: value.overallScore === 0 ? null : value.overallScore })
  return { expectedUpdatedAt, data, body: value }
}

export class HrEvaluationWorkflowError extends Error {
  constructor(public readonly status: 403 | 409, message: string) { super(message) }
}
export type HrEvaluationWorkflowAction = 'submit' | 'review' | 'finalize'
export function getHrEvaluationPhase(status: string): number | null {
  if (['DRAFT', 'SELF', 'SELF_REVIEW', 'SELF_EVALUATION'].includes(status)) return 0
  if (['SUBMITTED', 'IN_REVIEW', 'MANAGER_REVIEW'].includes(status)) return 1
  if (status === 'REVIEWED') return 2
  if (status === 'FINALIZED') return 3
  return null
}
/** Shared ordinary-write policy for form saves and AI admission/persistence. */
export function assertHrEvaluationEditable(status: string, role: EvaluationRatingField | null): void {
  if (!role || !['selfRating', 'managerRating', 'finalRating'].includes(role)) throw new HrEvaluationWorkflowError(403, '評価の役割を確認できません。')
  const phase = getHrEvaluationPhase(status)
  if (phase === null || phase === 3) throw new HrEvaluationWorkflowError(409, 'この評価の状態では変更できません。')
  if (role === 'selfRating' && phase !== 0 || role === 'managerRating' && phase !== 1) throw new HrEvaluationWorkflowError(409, '提出・レビュー済みの評価はこの役割では編集できません。')
}
export function resolveHrEvaluationWorkflowAction(status: string, role: EvaluationRatingField, action: HrEvaluationWorkflowAction): string {
  const phase = getHrEvaluationPhase(status)
  if (action === 'submit' && !['selfRating', 'finalRating'].includes(role) || action === 'review' && !['managerRating', 'finalRating'].includes(role) || action === 'finalize' && role !== 'finalRating') throw new HrEvaluationWorkflowError(403, 'この評価操作を実行する権限がありません。')
  if (phase !== ({ submit: 0, review: 1, finalize: 2 })[action]) throw new HrEvaluationWorkflowError(409, '評価の段階が変更されています。保存内容を確認してください。')
  return ({ submit: 'SUBMITTED', review: 'REVIEWED', finalize: 'FINALIZED' })[action]
}
/** Compatibility endpoint uses the same role/stage policy as explicit durable actions. */
export function resolveHrEvaluationSubmit(status: string, role: EvaluationRatingField): string {
  return resolveHrEvaluationWorkflowAction(status, role, role === 'managerRating' || role === 'finalRating' && getHrEvaluationPhase(status) === 1 ? 'review' : 'submit')
}
function canonicalWorkflowValue(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalWorkflowValue).join(',') + ']'
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalWorkflowValue((value as Record<string, unknown>)[key])).join(',') + '}'
  return JSON.stringify(value)
}
/** Caller holds current organization/member/evaluation/employee locks and has checked expectedUpdatedAt. */
export function getHrEvaluationWorkflowData(existing: { status: string } & Record<string, unknown>, role: EvaluationRatingField, body: Record<string, unknown>): Prisma.HrEvaluationUncheckedUpdateManyInput {
  if (!['selfRating', 'managerRating', 'finalRating'].includes(role)) throw new HrEvaluationWorkflowError(403, '評価の役割を確認できません。')
  const phase = getHrEvaluationPhase(existing.status)
  if (phase === null || phase === 3) throw new HrEvaluationWorkflowError(409, 'この評価の状態では変更できません。')
  const data: Prisma.HrEvaluationUncheckedUpdateManyInput = {}
  if ('workflowAction' in body) {
    data.status = resolveHrEvaluationWorkflowAction(existing.status, role, body.workflowAction as HrEvaluationWorkflowAction)
  } else if ('status' in body) {
    if (role !== 'finalRating') throw new HrEvaluationWorkflowError(403, '評価の状態を変更する権限がありません。')
    const target = getHrEvaluationPhase(body.status as string)
    if (target === null || !(target === phase || target === phase + 1 && body.status === ['SUBMITTED', 'REVIEWED', 'FINALIZED'][phase])) throw new HrEvaluationWorkflowError(409, '評価の段階を戻したり省略したりすることはできません。')
    data.status = body.status as string
  } else assertHrEvaluationEditable(existing.status, role)
  const protectedFields = phase >= 2 ? ['goals', 'competencies', 'selfRating', 'selfComment', 'managerRating', 'managerComment', 'evaluatorId'] : phase === 1 ? ['selfRating', 'selfComment'] : []
  for (const field of protectedFields) if (field in body && canonicalWorkflowValue(body[field]) !== canonicalWorkflowValue(existing[field])) throw new HrEvaluationWorkflowError(409, '提出・レビュー済みの内容を変更することはできません。')
  if (phase === 0) { data.submittedAt = null; data.reviewedAt = null; data.finalizedAt = null }
  if (phase === 1) { data.reviewedAt = null; data.finalizedAt = null }
  if (data.status === 'SUBMITTED' && phase === 0) data.submittedAt = new Date()
  if (data.status === 'REVIEWED' && phase === 1) data.reviewedAt = new Date()
  if (data.status === 'FINALIZED' && phase === 2) data.finalizedAt = new Date()
  return data
}
