import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import type { DepartmentHierarchyRow } from '@/lib/hr/department-hierarchy'

const PAGE_CHARACTERS = 65536
const FRAGMENT_CHARACTERS = 8192
const PAGE_FRAGMENTS = 50
export class HrDepartmentPageError extends Error {
  constructor(readonly status: 400 | 401 | 409, readonly code: 'INVALID_DEPARTMENT_CURSOR' | 'DEPARTMENTS_CHANGED' | 'DEPARTMENT_ACCESS_CHANGED') { super(code) }
}
type Cursor = { version: 1; revision: string; after: string | null; offset: number }
function cursor(value: string | null): Cursor | null {
  if (value === null) return null
  const invalid = (): never => { throw new HrDepartmentPageError(400, 'INVALID_DEPARTMENT_CURSOR') }
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
export function fragmentDepartmentPage(rows: readonly DepartmentHierarchyRow[], after: string | null, offset: number) {
  const fragments: { id: string; offset: number; text: string; complete: boolean }[] = []
  let remaining = PAGE_CHARACTERS, index = 0, last = after, position = offset
  while (index < rows.length && index < PAGE_FRAGMENTS && remaining > 0 && fragments.length < PAGE_FRAGMENTS) {
    const row = rows[index], encoded = JSON.stringify(row)
    if (position >= encoded.length) throw new HrDepartmentPageError(400, 'INVALID_DEPARTMENT_CURSOR')
    const length = Math.min(FRAGMENT_CHARACTERS, remaining, encoded.length - position)
    const text = encoded.slice(position, position + length), complete = position + length === encoded.length
    fragments.push({ id: row.id, offset: position, text, complete })
    position += length; remaining -= length
    if (complete) { last = row.id; position = 0; index++ }
  }
  return { fragments, after: last, offset: position, more: index < rows.length }
}

/** Read-only MVCC snapshot and revision prevent combining departments or employee counts from different states. */
export async function readHrDepartmentPage(db: PrismaClient, ctx: HrContext, encoded: string | null) {
  const previous = cursor(encoded)
  return db.$transaction(async tx => {
    const member = await tx.hrOrganizationMember.findFirst({ where: { id: ctx.memberId, userId: ctx.userId,
      organizationId: ctx.organizationId, status: 'ACTIVE', role: ctx.role }, select: { id: true, employeeId: true } })
    if (!member || member.employeeId !== ctx.employeeId) throw new HrDepartmentPageError(401, 'DEPARTMENT_ACCESS_CHANGED')
    const departmentState = await tx.$queryRaw<{ fingerprint: string; total: bigint }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(d)::text), '' ORDER BY d.id), '')) AS fingerprint, count(*) AS total
      FROM (SELECT id, xmin::text AS row_version FROM hr_departments WHERE "organizationId" = ${ctx.organizationId}) d
    `
    const employeeState = await tx.$queryRaw<{ fingerprint: string }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(e)::text), '' ORDER BY e.id), '')) AS fingerprint
      FROM (SELECT id, xmin::text AS row_version FROM hr_employees WHERE "organizationId" = ${ctx.organizationId}) e
    `
    const revision = createHash('sha256').update(JSON.stringify([ctx.userId, ctx.organizationId, ctx.memberId,
      ctx.role, ctx.employeeId, departmentState[0].fingerprint, employeeState[0].fingerprint])).digest('hex')
    if (previous && previous.revision !== revision) throw new HrDepartmentPageError(409, 'DEPARTMENTS_CHANGED')
    const source = await tx.hrDepartment.findMany({ where: { organizationId: ctx.organizationId,
      ...(previous?.after ? { id: { gt: previous.after } } : {}) },
      select: { id: true, name: true, code: true, parentId: true, managerId: true, sortOrder: true,
        isActive: true, _count: { select: { employees: { where: { organizationId: ctx.organizationId } } } } }, orderBy: { id: 'asc' }, take: PAGE_FRAGMENTS + 1 })
    if (previous?.offset && source.length === 0) throw new HrDepartmentPageError(400, 'INVALID_DEPARTMENT_CURSOR')
    const rows = source.map(d => ({ id: d.id, name: d.name, code: d.code, parentId: d.parentId,
      managerId: d.managerId, sortOrder: d.sortOrder, isActive: d.isActive, employeeCount: d._count.employees }))
    const page = fragmentDepartmentPage(rows, previous?.after ?? null, previous?.offset ?? 0)
    const next: Cursor = { version: 1, revision, after: page.after, offset: page.offset }
    return { success: true as const, format: 'hr-department-page-v1' as const, organizationId: ctx.organizationId,
      revision, total: Number(departmentState[0].total), fragments: page.fragments,
      nextCursor: page.more ? Buffer.from(JSON.stringify(next)).toString('base64url') : null }
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 15000 })
}
