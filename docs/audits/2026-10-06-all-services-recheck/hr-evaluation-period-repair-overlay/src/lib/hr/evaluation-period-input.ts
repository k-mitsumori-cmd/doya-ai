import { EvaluationPeriodStatus } from '@/lib/hr/types'

export class HrEvaluationPeriodInputError extends Error {}
const invalid = (): never => { throw new HrEvaluationPeriodInputError('評価期間の更新内容が正しくありません。再取得して入力内容を確認してください。') }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

function date(value: unknown): Date {
  if (typeof value !== 'string') return invalid()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value + 'T00:00:00.000Z')
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalid()
    return parsed
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) return invalid()
  return parsed
}

const fields = ['name', 'startDate', 'endDate', 'status', 'evaluationTemplate']
function readFields(value: Record<string, unknown>) {
  const data: { name?: string; startDate?: Date; endDate?: Date; status?: string; evaluationTemplate?: unknown } = {}
  if ('name' in value) {
    if (typeof value.name !== 'string' || !value.name.trim()) return invalid()
    data.name = value.name.trim()
  }
  if ('startDate' in value) data.startDate = date(value.startDate)
  if ('endDate' in value) data.endDate = date(value.endDate)
  if ('status' in value) {
    if (typeof value.status !== 'string' || !new Set<string>(Object.values(EvaluationPeriodStatus)).has(value.status)) return invalid()
    data.status = value.status
  }
  if ('evaluationTemplate' in value) data.evaluationTemplate = value.evaluationTemplate
  if (!Object.keys(data).length) return invalid()
  if (data.startDate && data.endDate && data.startDate > data.endDate) return invalid()
  return data
}

/** Parse the exact version and complete update before any database mutation. */
export function readHrEvaluationPeriodPatch(value: unknown) {
  if (!object(value) || Object.keys(value).some(key => key !== 'expectedUpdatedAt' && !fields.includes(key))) return invalid()
  if (typeof value.expectedUpdatedAt !== 'string') return invalid()
  const expectedUpdatedAt = date(value.expectedUpdatedAt)
  if (expectedUpdatedAt.toISOString() !== value.expectedUpdatedAt) return invalid()
  return { expectedUpdatedAt, data: readFields(value) }
}

/** Creation shares the same complete status/date validation; no synthetic version is accepted. */
export function readHrEvaluationPeriodCreate(value: unknown) {
  if (!object(value) || Object.keys(value).some(key => !fields.includes(key)) || !['name', 'startDate', 'endDate'].every(key => key in value)) return invalid()
  const data = readFields(value)
  return { ...data, name: data.name!, startDate: data.startDate!, endDate: data.endDate!, status: data.status ?? 'DRAFT' }
}

/** A partial date edit must also be compared with the currently locked period. */
export function validateHrEvaluationPeriodRange(data: { startDate?: Date; endDate?: Date }, current: { startDate: Date; endDate: Date }) {
  if ((data.startDate ?? current.startDate) > (data.endDate ?? current.endDate)) return invalid()
}
