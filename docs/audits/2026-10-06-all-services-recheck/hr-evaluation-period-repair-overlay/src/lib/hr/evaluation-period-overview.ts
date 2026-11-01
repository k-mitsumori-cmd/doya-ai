import { createHash } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { evaluationOrganizationWhere, redactEvaluationDepartment } from '@/lib/hr/evaluation-scope'

export class HrEvaluationOverviewError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409) { super('評価期間を再取得して、ログイン状態と権限を確認してください。') }
}
type Cursor = { version: 1; revision: string; phase: 'period' | 'employee'; after: string | null; offset: number }
function parseCursor(encoded: string | null): Cursor | null {
  if (encoded === null) return null
  const invalid = (): never => { throw new HrEvaluationOverviewError(400) }
  if (!/^[a-zA-Z0-9_-]{1,16384}$/.test(encoded)) return invalid()
  let value: unknown
  try { value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) } catch { return invalid() }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const row = value as Record<string, unknown>
  if (Object.keys(row).sort().join(',') !== 'after,offset,phase,revision,version' || row.version !== 1 ||
    typeof row.revision !== 'string' || !/^[a-f0-9]{64}$/.test(row.revision) ||
    !['period', 'employee'].includes(row.phase as string) ||
    !(row.after === null || typeof row.after === 'string' && Boolean(row.after)) ||
    row.phase === 'period' && row.after !== null || !Number.isSafeInteger(row.offset) || (row.offset as number) < 0) return invalid()
  return row as Cursor
}

/** One read-only snapshot contains only rows the current reader can actually display. */
export async function readHrEvaluationPeriodOverview(db: PrismaClient, ctx: HrContext, periodId: string, encoded: string | null) {
  const previous = parseCursor(encoded)
  return db.$transaction(async tx => {
    const member = await tx.hrOrganizationMember.findFirst({ where: { id: ctx.memberId, userId: ctx.userId,
      organizationId: ctx.organizationId, status: 'ACTIVE', role: ctx.role }, select: { role: true, employeeId: true } })
    if (!member || member.employeeId !== (ctx.employeeId ?? null)) throw new HrEvaluationOverviewError(401)
    if (!['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(member.role)) throw new HrEvaluationOverviewError(403)
    const admin = member.role === 'OWNER' || member.role === 'ADMIN'
    if (!admin && (!member.employeeId || await tx.hrEmployee.count({ where: { id: member.employeeId, organizationId: ctx.organizationId } }) !== 1)) throw new HrEvaluationOverviewError(403)
    const period = await tx.hrEvaluationPeriod.findFirst({ where: { id: periodId, organizationId: ctx.organizationId },
      select: { id: true, organizationId: true, name: true, startDate: true, endDate: true, status: true, updatedAt: true } })
    if (!period) throw new HrEvaluationOverviewError(404)
    const ownEvaluations: Prisma.HrEvaluationWhereInput = { ...evaluationOrganizationWhere(ctx.organizationId), periodId,
      ...(!admin ? { OR: [{ employeeId: member.employeeId! }, { evaluatorId: member.employeeId! }] } : {}) }
    const employeesWhere: Prisma.HrEmployeeWhereInput = { organizationId: ctx.organizationId,
      ...(!admin ? { OR: [{ id: member.employeeId! }, { evaluations: { some: ownEvaluations } }] } : {}) }
    const states = await Promise.all([
      tx.$queryRaw<{ fingerprint: string }[]>`SELECT md5(COALESCE(string_agg(md5(row_to_json(r)::text), '' ORDER BY r.id), '')) AS fingerprint FROM (SELECT id, xmin::text AS version FROM hr_employees WHERE "organizationId" = ${ctx.organizationId}) r`,
      tx.$queryRaw<{ fingerprint: string }[]>`SELECT md5(COALESCE(string_agg(md5(row_to_json(r)::text), '' ORDER BY r.id), '')) AS fingerprint FROM (SELECT id, xmin::text AS version FROM hr_departments WHERE "organizationId" = ${ctx.organizationId}) r`,
      tx.$queryRaw<{ fingerprint: string }[]>`SELECT md5(COALESCE(string_agg(md5(row_to_json(r)::text), '' ORDER BY r.id), '')) AS fingerprint FROM (SELECT id, xmin::text AS version FROM hr_evaluations WHERE "periodId" = ${periodId}) r`,
      tx.$queryRaw<{ fingerprint: string }[]>`SELECT md5(COALESCE(string_agg(md5(row_to_json(r)::text), '' ORDER BY r.id), '')) AS fingerprint FROM (SELECT id, xmin::text AS version FROM hr_evaluation_periods WHERE id = ${periodId} AND "organizationId" = ${ctx.organizationId}) r`,
    ])
    const revision = createHash('sha256').update(JSON.stringify([ctx.userId, ctx.organizationId, ctx.memberId, member.role,
      member.employeeId, periodId, ...states.map(rows => rows[0].fingerprint)])).digest('hex')
    if (previous && previous.revision !== revision) throw new HrEvaluationOverviewError(409)
    if (previous?.after && await tx.hrEmployee.count({ where: { AND: [employeesWhere, { id: previous.after }] } }) !== 1) throw new HrEvaluationOverviewError(400)
    const [totalEmployees, evaluationCount, employees] = await Promise.all([
      tx.hrEmployee.count({ where: employeesWhere }), tx.hrEvaluation.count({ where: ownEvaluations }),
      tx.hrEmployee.findMany({ where: { AND: [employeesWhere, ...(previous?.after ? [{ id: { gt: previous.after } }] : [])] },
        select: { id: true, firstName: true, lastName: true, departmentId: true,
          department: { select: { id: true, name: true, organizationId: true } } }, orderBy: { id: 'asc' }, take: 51 }),
    ])
    const identifiers = employees.map(employee => employee.id)
    const [evaluations, existing] = await Promise.all([
      tx.hrEvaluation.findMany({ where: { ...ownEvaluations, employeeId: { in: identifiers } }, select: { id: true, employeeId: true, status: true } }),
      admin ? tx.hrEvaluation.findMany({ where: { periodId, employeeId: { in: identifiers } }, select: { employeeId: true } }) : Promise.resolve([]),
    ])
    const byEmployee = new Map(evaluations.map(evaluation => [evaluation.employeeId, { id: evaluation.id, status: evaluation.status }]))
    const unavailable = new Set(existing.map(evaluation => evaluation.employeeId))
    type RecordRow = { kind: 'period' | 'employee'; id: string; value: unknown }
    const records: RecordRow[] = [
      ...(!previous || previous.phase === 'period' ? [{ kind: 'period' as const, id: periodId, value: { kind: 'period', period: { ...period,
        startDate: period.startDate.toISOString(), endDate: period.endDate.toISOString(), updatedAt: period.updatedAt.toISOString(),
        canManageEvaluations: admin, evaluationCount } } }] : []),
      ...employees.map(employee => ({ kind: 'employee' as const, id: employee.id, value: { kind: 'employee', employee: {
        ...redactEvaluationDepartment(employee, ctx.organizationId), evaluation: byEmployee.get(employee.id) ?? null,
        evaluationUnavailable: !byEmployee.has(employee.id) && unavailable.has(employee.id),
      } } })),
    ]
    let phase: Cursor['phase'] = previous?.phase ?? 'period', after = previous?.after ?? null, offset = previous?.offset ?? 0
    let index = 0, characters = 0, encodedIndex = -1, encodedRecord = ''
    const fragments: { kind: 'period' | 'employee'; id: string; offset: number; text: string; complete: boolean }[] = []
    while (index < records.length && fragments.length < 50 && characters < 65536) {
      const record = records[index]
      if (encodedIndex !== index) { encodedRecord = JSON.stringify(record.value); encodedIndex = index }
      const json = encodedRecord
      if (offset >= json.length) throw new HrEvaluationOverviewError(400)
      const length = Math.min(8192, 65536 - characters, json.length - offset), complete = offset + length === json.length
      fragments.push({ kind: record.kind, id: record.id, offset, text: json.slice(offset, offset + length), complete })
      offset += length; characters += length
      if (complete) { if (record.kind === 'period') { phase = 'employee'; after = null } else after = record.id; offset = 0; index++ }
    }
    if (previous?.offset && records.length === 0) throw new HrEvaluationOverviewError(400)
    const next: Cursor = { version: 1, revision, phase, after, offset }
    return { success: true as const, format: 'hr-evaluation-period-page-v1' as const, organizationId: ctx.organizationId, periodId,
      revision, totalEmployees, fragments, nextCursor: index < records.length ? Buffer.from(JSON.stringify(next)).toString('base64url') : null }
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 15000 })
}
