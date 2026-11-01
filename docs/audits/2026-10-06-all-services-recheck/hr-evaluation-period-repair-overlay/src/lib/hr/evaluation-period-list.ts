import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { getEvaluationReader } from '@/lib/hr/evaluation-access'
import { evaluationOrganizationWhere } from '@/lib/hr/evaluation-scope'
import type { HrEvaluationPeriodListRow } from '@/lib/hr/evaluation-period-list-client'

const PAGE_CHARACTERS = 65536
const FRAGMENT_CHARACTERS = 8192
const PAGE_FRAGMENTS = 50
export class HrEvaluationPeriodListError extends Error {
  constructor(readonly status: 400 | 401 | 409, readonly code: 'INVALID_PERIOD_LIST_CURSOR' | 'PERIOD_LIST_CHANGED' | 'PERIOD_LIST_ACCESS_CHANGED') { super(code) }
}
type Cursor = { version: 1; revision: string; after: string | null; offset: number }
function cursor(value: string | null): Cursor | null {
  if (value === null) return null
  const invalid = (): never => { throw new HrEvaluationPeriodListError(400, 'INVALID_PERIOD_LIST_CURSOR') }
  if (!/^[a-zA-Z0-9_-]{1,16384}$/.test(value)) return invalid()
  let parsed: unknown
  try { parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) } catch { return invalid() }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid()
  const item = parsed as Record<string, unknown>
  if (Object.keys(item).sort().join(',') !== 'after,offset,revision,version' || item.version !== 1 ||
    typeof item.revision !== 'string' || !/^[a-f0-9]{64}$/.test(item.revision) ||
    !(item.after === null || (typeof item.after === 'string' && Boolean(item.after))) ||
    !Number.isSafeInteger(item.offset) || (item.offset as number) < 0) return invalid()
  return item as Cursor
}

/** Bound each response, including a single unusually large row, without truncating any field or total rows. */
export function fragmentHrEvaluationPeriodList(rows: readonly HrEvaluationPeriodListRow[], after: string | null, offset: number) {
  const fragments: { id: string; offset: number; text: string; complete: boolean }[] = []
  let remaining = PAGE_CHARACTERS, index = 0, last = after, position = offset
  while (index < rows.length && index < PAGE_FRAGMENTS && remaining > 0 && fragments.length < PAGE_FRAGMENTS) {
    const row = rows[index], encoded = JSON.stringify(row)
    if (position >= encoded.length) throw new HrEvaluationPeriodListError(400, 'INVALID_PERIOD_LIST_CURSOR')
    const length = Math.min(FRAGMENT_CHARACTERS, remaining, encoded.length - position)
    const text = encoded.slice(position, position + length), complete = position + length === encoded.length
    fragments.push({ id: row.id, offset: position, text, complete })
    position += length; remaining -= length
    if (complete) { last = row.id; position = 0; index++ }
  }
  return { fragments, after: last, offset: position, more: index < rows.length }
}

/** Read-only MVCC snapshot and revision prevent combining periods or evaluation counts from different states. */
export async function readHrEvaluationPeriodListPage(db: PrismaClient, ctx: HrContext, encoded: string | null) {
  const previous = cursor(encoded)
  return db.$transaction(async tx => {
    const member = await tx.hrOrganizationMember.findFirst({ where: { id: ctx.memberId, userId: ctx.userId,
      organizationId: ctx.organizationId, status: 'ACTIVE', role: ctx.role }, select: { employeeId: true } })
    if (!member || member.employeeId !== ctx.employeeId || !['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(ctx.role)) throw new HrEvaluationPeriodListError(401, 'PERIOD_LIST_ACCESS_CHANGED')
    const reader = await getEvaluationReader(ctx, tx), canCreatePeriods = ['OWNER', 'ADMIN'].includes(ctx.role)
    const periodState = await tx.$queryRaw<{ fingerprint: string; total: bigint }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(p)::text), '' ORDER BY p.id), '')) AS fingerprint, count(*) AS total
      FROM (SELECT id, xmin::text AS row_version FROM hr_evaluation_periods WHERE "organizationId" = ${ctx.organizationId}) p
    `
    const evaluationState = await tx.$queryRaw<{ fingerprint: string }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(e)::text), '' ORDER BY e.id), '')) AS fingerprint
      FROM (SELECT e.id, e.xmin::text AS row_version FROM hr_evaluations e
        JOIN hr_evaluation_periods p ON p.id = e."periodId" WHERE p."organizationId" = ${ctx.organizationId}) e
    `
    const employeeState = await tx.$queryRaw<{ fingerprint: string }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(e)::text), '' ORDER BY e.id), '')) AS fingerprint
      FROM (SELECT id, xmin::text AS row_version FROM hr_employees WHERE "organizationId" = ${ctx.organizationId}) e
    `
    const total = Number(periodState[0].total)
    if (!Number.isSafeInteger(total) || total < 0) throw Error('Invalid period total')
    const revision = createHash('sha256').update(JSON.stringify([ctx.userId, ctx.organizationId, ctx.memberId,
      ctx.role, ctx.employeeId, reader?.employeeId, periodState[0].fingerprint, evaluationState[0].fingerprint, employeeState[0].fingerprint])).digest('hex')
    if (previous && previous.revision !== revision) throw new HrEvaluationPeriodListError(409, 'PERIOD_LIST_CHANGED')
    const source = await tx.hrEvaluationPeriod.findMany({ where: { organizationId: ctx.organizationId,
      ...(previous?.after ? { id: { gt: previous.after } } : {}) },
      select: { id: true, name: true, startDate: true, endDate: true, status: true }, orderBy: { id: 'asc' }, take: PAGE_FRAGMENTS + 1 })
    if (previous?.offset && source.length === 0) throw new HrEvaluationPeriodListError(400, 'INVALID_PERIOD_LIST_CURSOR')
    const visible = reader ? { ...evaluationOrganizationWhere(ctx.organizationId), ...(reader.employeeId === null ? {} : { OR: [{ employeeId: reader.employeeId }, { evaluatorId: reader.employeeId }] }) } : { id: { in: [] as string[] } }
    const where = { ...visible, periodId: { in: source.map(p => p.id) } }
    const [counts, completed] = await Promise.all([
      tx.hrEvaluation.groupBy({ by: ['periodId'], where, _count: { _all: true } }),
      tx.hrEvaluation.groupBy({ by: ['periodId'], where: { ...where, status: 'FINALIZED' }, _count: { _all: true } }),
    ])
    const countMap = new Map(counts.map(r => [r.periodId, r._count._all])), completedMap = new Map(completed.map(r => [r.periodId, r._count._all]))
    const rows: HrEvaluationPeriodListRow[] = source.map(p => ({ id: p.id, name: p.name, startDate: p.startDate.toISOString(), endDate: p.endDate.toISOString(), status: p.status,
      evaluationCount: countMap.get(p.id) ?? 0, completedEvaluations: completedMap.get(p.id) ?? 0 }))
    const page = fragmentHrEvaluationPeriodList(rows, previous?.after ?? null, previous?.offset ?? 0)
    const next: Cursor = { version: 1, revision, after: page.after, offset: page.offset }
    return { success: true as const, format: 'hr-evaluation-period-page-v1' as const, canCreatePeriods, organizationId: ctx.organizationId,
      revision, total, fragments: page.fragments,
      nextCursor: page.more ? Buffer.from(JSON.stringify(next)).toString('base64url') : null }
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 15000 })
}
