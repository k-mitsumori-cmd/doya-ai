import type { EvaluationRatingField } from '@/lib/hr/evaluation-access'
export type EvaluationGoal = { id: string; title: string; description: string; weight: number; result: string; score: number }
export type EvaluationDetail = {
  id: string; employeeId: string; evaluatorId: string | null; evaluatorName: string | null; periodId: string; organizationId: string; employeeName: string; periodName: string
  updatedAt: string; status: string; ratingField: EvaluationRatingField; isManager: boolean; overallScore: number
  goals: EvaluationGoal[]; selfComment: string; managerComment: string
}
const evaluationStatusPresentation: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600' },
  SELF: { label: '自己評価中', color: 'bg-amber-100 text-amber-700' },
  SELF_REVIEW: { label: '自己評価中', color: 'bg-amber-100 text-amber-700' },
  SELF_EVALUATION: { label: '自己評価中', color: 'bg-amber-100 text-amber-700' },
  IN_REVIEW: { label: '上司評価中', color: 'bg-blue-100 text-blue-700' },
  MANAGER_REVIEW: { label: '上司評価中', color: 'bg-blue-100 text-blue-700' },
  SUBMITTED: { label: '提出済み', color: 'bg-sky-100 text-sky-700' },
  REVIEWED: { label: '評価済み', color: 'bg-emerald-100 text-emerald-700' },
  FINALIZED: { label: '確定済み', color: 'bg-emerald-100 text-emerald-700' },
}
export const knownEvaluationDetailStatus = (status: string) => Object.prototype.hasOwnProperty.call(evaluationStatusPresentation, status)
export function getHrEvaluationStatusPresentation(status: string): { label: string; color: string } {
  return knownEvaluationDetailStatus(status) ? { ...evaluationStatusPresentation[status] } : { label: '状態不明', color: 'bg-slate-100 text-slate-600' }
}
export type HrEvaluationWorkflowAction = 'submit' | 'review' | 'finalize'
export function getHrEvaluationClientPhase(status: string): number | null {
  if (['DRAFT', 'SELF', 'SELF_REVIEW', 'SELF_EVALUATION'].includes(status)) return 0
  if (['SUBMITTED', 'IN_REVIEW', 'MANAGER_REVIEW'].includes(status)) return 1
  return status === 'REVIEWED' ? 2 : status === 'FINALIZED' ? 3 : null
}
export function canEditHrEvaluation(status: string, role: EvaluationRatingField): boolean {
  const phase = getHrEvaluationClientPhase(status)
  return phase !== null && phase < 3 && (role === 'finalRating' || role === 'selfRating' && phase === 0 || role === 'managerRating' && phase === 1)
}
export function getHrEvaluationWorkflowAction(status: string, role: EvaluationRatingField): { action: HrEvaluationWorkflowAction; targetStatus: string; label: string } | null {
  const phase = getHrEvaluationClientPhase(status)
  if (phase === 0 && (role === 'selfRating' || role === 'finalRating')) return { action: 'submit', targetStatus: 'SUBMITTED', label: role === 'finalRating' ? '自己評価の提出を記録する' : '自己評価を提出する' }
  if (phase === 1 && (role === 'managerRating' || role === 'finalRating')) return { action: 'review', targetStatus: 'REVIEWED', label: role === 'finalRating' ? 'レビュー完了にする' : '上司評価を完了する' }
  if (phase === 2 && role === 'finalRating') return { action: 'finalize', targetStatus: 'FINALIZED', label: '評価を確定する' }
  return null
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown): value is string => typeof value === 'string' && Boolean(value)
const iso = (value: unknown): value is string => string(value) && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
const invalid = (): never => { throw Error('評価データの応答を確認できませんでした。入力を変更せず、再取得してください。') }
const comment = (value: unknown): string => value === null ? '' : typeof value === 'string' ? value : invalid()
function goals(value: unknown): EvaluationGoal[] {
  if (value === null) return []
  if (!Array.isArray(value)) return invalid()
  const ids = new Set<string>()
  return value.map(goal => {
    if (!object(goal) || !string(goal.id) || ids.has(goal.id) || typeof goal.title !== 'string') return invalid()
    ids.add(goal.id)
    const description = goal.description === undefined ? '' : comment(goal.description), result = goal.result === undefined ? '' : comment(goal.result)
    const weight = goal.weight === undefined ? 0 : goal.weight, score = goal.score === undefined ? 0 : goal.score
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 100 || typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 5) return invalid()
    return { ...goal, id: goal.id, title: goal.title, description, result, weight, score }
  })
}
function core(value: unknown, id: string) {
  if (!object(value) || value.id !== id || !string(value.employeeId) || !(value.evaluatorId === null || string(value.evaluatorId)) || !string(value.periodId) || !iso(value.updatedAt) || !string(value.status) ||
    !['selfRating', 'managerRating', 'finalRating'].includes(value.ratingField as string) || typeof value.isManager !== 'boolean' ||
    value.isManager !== (value.ratingField !== 'selfRating') || typeof value.overallScore !== 'number' || !Number.isInteger(value.overallScore) || value.overallScore < 0 || value.overallScore > 5) return invalid()
  const ratingField = value.ratingField as EvaluationRatingField, rawScore = value[ratingField]
  if (!(rawScore === null || typeof rawScore === 'number' && Number.isInteger(rawScore) && rawScore >= 0 && rawScore <= 5) || (rawScore ?? 0) !== value.overallScore) return invalid()
  return { id, employeeId: value.employeeId, evaluatorId: value.evaluatorId as string | null, periodId: value.periodId, updatedAt: value.updatedAt, status: value.status, ratingField,
    isManager: value.isManager, overallScore: value.overallScore, goals: goals(value.goals), selfComment: comment(value.selfComment), managerComment: comment(value.managerComment) }
}
export function readHrEvaluationDetail(value: unknown, id: string, expectedOrganization?: string): EvaluationDetail {
  if (!object(value) || value.success !== true || !object(value.evaluation)) return invalid()
  const row = value.evaluation, parsed = core(row, id)
  if (!object(row.period) || row.period.id !== parsed.periodId || !string(row.period.organizationId) ||
    expectedOrganization !== undefined && row.period.organizationId !== expectedOrganization || typeof row.employeeName !== 'string' || typeof row.periodName !== 'string') return invalid()
  return { ...parsed, evaluatorName: readEvaluatorName(row, parsed.evaluatorId), organizationId: row.period.organizationId, employeeName: row.employeeName, periodName: row.periodName }
}
function readEvaluatorName(row: Record<string, unknown>, evaluatorId: string | null): string | null {
  if (evaluatorId === null) return row.evaluator == null ? null : invalid()
  if (!object(row.evaluator) || row.evaluator.id !== evaluatorId || typeof row.evaluator.firstName !== 'string' || typeof row.evaluator.lastName !== 'string') return invalid()
  return `${row.evaluator.lastName} ${row.evaluator.firstName}`.trim() || '名称未設定'
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  return JSON.stringify(value)
}
/** A200 is not a successful save until identity, version and every submitted field match. */
export function readHrEvaluationSaveAcknowledgment(value: unknown, previous: EvaluationDetail, submitted: Record<string, unknown>): EvaluationDetail {
  if (!object(value) || value.success !== true || !object(value.evaluation)) return invalid()
  const row = value.evaluation, parsed = core(row, previous.id)
  const action = getHrEvaluationWorkflowAction(previous.status, previous.ratingField)
  let expectedStatus = previous.status
  if ('workflowAction' in submitted) { if (!action || action.action !== submitted.workflowAction) return invalid(); expectedStatus = action.targetStatus }
  if (parsed.employeeId !== previous.employeeId || parsed.periodId !== previous.periodId || parsed.ratingField !== previous.ratingField || parsed.status !== expectedStatus ||
    new Date(parsed.updatedAt).getTime() <= new Date(previous.updatedAt).getTime()) return invalid()
  if ('workflowAction' in submitted && (parsed.overallScore !== previous.overallScore || parsed.selfComment !== previous.selfComment || parsed.managerComment !== previous.managerComment || canonical(parsed.goals) !== canonical(previous.goals))) return invalid()
  for (const field of ['goals', 'selfComment', 'managerComment'] as const) if (field in submitted && canonical(row[field]) !== canonical(submitted[field])) return invalid()
  if ('overallScore' in submitted && parsed.overallScore !== submitted.overallScore) return invalid()
  if (parsed.evaluatorId !== ('evaluatorId' in submitted ? submitted.evaluatorId : previous.evaluatorId)) return invalid()
  const evaluatorName = row.evaluator === undefined ? parsed.evaluatorId === previous.evaluatorId ? previous.evaluatorName : null : readEvaluatorName(row, parsed.evaluatorId)
  return { ...previous, ...parsed, evaluatorName }
}
