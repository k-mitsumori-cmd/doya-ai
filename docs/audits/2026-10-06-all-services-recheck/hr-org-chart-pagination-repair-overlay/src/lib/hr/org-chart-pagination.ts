import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { HrContext } from '@/lib/hr/types'
import { hasMinRole } from '@/lib/hr/access'

const PAGE_SIZE = 50
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
type Cursor = { version: 1; revision: string; departmentAfter: string | null; employeeAfter: string | null; departmentsDone: boolean; employeesDone: boolean }
export class HrOrgChartPageError extends Error {
  constructor(readonly status: 400 | 401 | 409, readonly code: 'INVALID_ORG_CHART_CURSOR' | 'ORG_CHART_CHANGED' | 'ORG_CHART_ACCESS_CHANGED') { super(code) }
}
function decodeCursor(value: string | null): Cursor | null {
  if (value === null) return null
  const invalid = (): never => { throw new HrOrgChartPageError(400, 'INVALID_ORG_CHART_CURSOR') }
  if (!/^[a-zA-Z0-9_-]{1,1000}$/.test(value)) return invalid()
  let parsed: unknown
  try { parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) } catch { return invalid() }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid()
  const cursor = parsed as Record<string, unknown>
  if (Object.keys(cursor).sort().join(',') !== 'departmentAfter,departmentsDone,employeeAfter,employeesDone,revision,version') return invalid()
  if (cursor.version !== 1 || typeof cursor.revision !== 'string' || !/^[a-f0-9]{64}$/.test(cursor.revision) ||
    !(cursor.departmentAfter === null || identifier(cursor.departmentAfter)) || !(cursor.employeeAfter === null || identifier(cursor.employeeAfter)) ||
    typeof cursor.departmentsDone !== 'boolean' || typeof cursor.employeesDone !== 'boolean' || (cursor.departmentsDone && cursor.employeesDone)) return invalid()
  return cursor as Cursor
}

/** Each read-only page has its own consistent DB snapshot; a digest rejects mixed revisions across pages. */
export async function readHrOrgChartPage(db: PrismaClient, ctx: HrContext, encodedCursor: string | null) {
  const cursor = decodeCursor(encodedCursor)
  if (!hasMinRole(ctx.role, 'MEMBER')) throw new HrOrgChartPageError(401, 'ORG_CHART_ACCESS_CHANGED')
  const readAllEmployees = hasMinRole(ctx.role, 'MANAGER')
  return db.$transaction(async tx => {
    const member = await tx.hrOrganizationMember.findFirst({ where: { id: ctx.memberId, userId: ctx.userId, organizationId: ctx.organizationId, status: 'ACTIVE', role: ctx.role }, select: { id: true, employeeId: true } })
    if (!member || member.employeeId !== ctx.employeeId) throw new HrOrgChartPageError(401, 'ORG_CHART_ACCESS_CHANGED')
    const org = await tx.hrOrganization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } })
    // MVCC tuple revisions detect edits, including direct SQL changes, without rehashing photo/name payloads on every page.
    const departmentState = await tx.$queryRaw<{ fingerprint: string; total: bigint }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(d)::text), '' ORDER BY d.id), '')) AS fingerprint, count(*) AS total
      FROM (SELECT id, xmin::text AS row_version FROM hr_departments
        WHERE "organizationId" = ${ctx.organizationId} AND "isActive" = true) d
    `
    const employeeState = await tx.$queryRaw<{ fingerprint: string; total: bigint }[]>`
      SELECT md5(COALESCE(string_agg(md5(row_to_json(e)::text), '' ORDER BY e.id), '')) AS fingerprint, count(*) AS total
      FROM (SELECT id, xmin::text AS row_version FROM hr_employees
        WHERE "organizationId" = ${ctx.organizationId} AND status = 'ACTIVE'
          AND (${readAllEmployees} OR id = ${ctx.employeeId || ''})) e
    `
    const revision = createHash('sha256').update(JSON.stringify([
      ctx.userId, ctx.organizationId, ctx.memberId, ctx.role, ctx.employeeId, org?.name || '',
      departmentState[0].fingerprint, employeeState[0].fingerprint,
    ])).digest('hex')
    if (cursor && cursor.revision !== revision) throw new HrOrgChartPageError(409, 'ORG_CHART_CHANGED')
    const [departmentRows, employeeRows] = await Promise.all([
      cursor?.departmentsDone ? [] : tx.hrDepartment.findMany({
        where: { organizationId: ctx.organizationId, isActive: true, ...(cursor?.departmentAfter ? { id: { gt: cursor.departmentAfter } } : {}) },
        select: { id: true, name: true, code: true, parentId: true, managerId: true, sortOrder: true }, orderBy: { id: 'asc' }, take: PAGE_SIZE + 1,
      }),
      cursor?.employeesDone ? [] : tx.hrEmployee.findMany({
        where: { organizationId: ctx.organizationId, status: 'ACTIVE',
          ...(!readAllEmployees ? { id: ctx.employeeId || { in: [] } } : {}),
          ...(cursor?.employeeAfter ? { AND: [{ id: { gt: cursor.employeeAfter } }] } : {}),
        },
        select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true, employeeNumber: true, departmentId: true },
        orderBy: { id: 'asc' }, take: PAGE_SIZE + 1,
      }),
    ])
    const departments = departmentRows.slice(0, PAGE_SIZE), employees = employeeRows.slice(0, PAGE_SIZE)
    const departmentsDone = Boolean(cursor?.departmentsDone) || departmentRows.length <= PAGE_SIZE
    const employeesDone = Boolean(cursor?.employeesDone) || employeeRows.length <= PAGE_SIZE
    const next: Cursor = { version: 1, revision,
      departmentAfter: departments.at(-1)?.id || cursor?.departmentAfter || null,
      employeeAfter: employees.at(-1)?.id || cursor?.employeeAfter || null,
      departmentsDone, employeesDone,
    }
    return { success: true as const, format: 'hr-org-chart-page-v1' as const, orgName: org?.name || '', revision,
      departments, employees,
      totals: { departments: Number(departmentState[0].total), employees: Number(employeeState[0].total) },
      nextCursor: departmentsDone && employeesDone ? null : Buffer.from(JSON.stringify(next)).toString('base64url'),
    }
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 15000 })
}
