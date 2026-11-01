import type { OrgChartNode } from '@/lib/hr/types'

type Employee = OrgChartNode['employees'][number]
type Department = OrgChartNode['department'] & { parentId: string | null; sortOrder: number }
type EmployeeRow = Employee & { departmentId: string | null }
export type HrOrgChartData = { orgName: string; orgChart: OrgChartNode[]; unassignedEmployees: Employee[]; hierarchyWarning: boolean }
export class HrOrgChartReadError extends Error {
  constructor(readonly unauthorized = false, readonly changed = false) { super('HR org chart read failed') }
}
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const nullableId = (value: unknown) => value === null || identifier(value)
const nullableText = (value: unknown) => value === null || text(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
function parsePage(value: unknown) {
  const invalid = (): never => { throw new Error('HR org chart page invalid') }
  if (!isObject(value) || value.success !== true || value.format !== 'hr-org-chart-page-v1' || !text(value.orgName) || typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision) ||
    !isObject(value.totals) || !integer(value.totals.departments) || !integer(value.totals.employees) || !Number.isSafeInteger(value.totals.departments + value.totals.employees) ||
    !(value.nextCursor === null || (typeof value.nextCursor === 'string' && /^[a-zA-Z0-9_-]{1,1000}$/.test(value.nextCursor))) ||
    !Array.isArray(value.departments) || value.departments.length > 50 || !Array.isArray(value.employees) || value.employees.length > 50) return invalid()
  const departments: Department[] = value.departments.map(row => {
    if (!isObject(row) || !identifier(row.id) || !text(row.name) || !nullableText(row.code) || !nullableId(row.parentId) || !nullableId(row.managerId) || !Number.isSafeInteger(row.sortOrder)) return invalid()
    return { id: row.id, name: row.name, code: row.code as string | null, parentId: row.parentId as string | null, managerId: row.managerId as string | null, sortOrder: row.sortOrder as number }
  })
  const employees: EmployeeRow[] = value.employees.map(row => {
    if (!isObject(row) || !identifier(row.id) || !text(row.firstName) || !text(row.lastName) || !nullableText(row.position) || !nullableText(row.photoUrl) || !nullableText(row.employeeNumber) || !nullableId(row.departmentId)) return invalid()
    return { id: row.id, firstName: row.firstName, lastName: row.lastName, position: row.position as string | null, photoUrl: row.photoUrl as string | null, employeeNumber: row.employeeNumber as string | null, departmentId: row.departmentId as string | null }
  })
  return { orgName: value.orgName, revision: value.revision, departments, employees, totals: { departments: value.totals.departments, employees: value.totals.employees }, nextCursor: value.nextCursor as string | null }
}

/** Bound each transport page, without converting an employee plan into an arbitrary total chart-size cap. */
async function readPage(signal: AbortSignal, cursor: string | null) {
  if (signal.aborted) throw new Error('HR org chart read cancelled')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error('HR org chart read cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('HR org chart read timed out')) }, 35000)
  })
  const work = (async () => {
    const response = await fetch('/api/hr/org-chart?format=pages' + (cursor === null ? '' : '&cursor=' + encodeURIComponent(cursor)), { method: 'GET', cache: 'no-store', signal: controller.signal })
    if (response.status === 401) throw new HrOrgChartReadError(true)
    if (response.status === 409) throw new HrOrgChartReadError(false, true)
    if (response.status !== 200 || controller.signal.aborted || !response.body || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('HR org chart read failed')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new Error('HR org chart read cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 1024 * 1024) throw new Error('HR org chart page too large')
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return parsePage(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  })()
  try { return await Promise.race([work, stop]) } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}

/** Assemble iteratively: valid deep hierarchies do not hit a recursive parser's depth ceiling. */
export function assembleHrOrgChart(orgName: string, departments: Department[], employees: EmployeeRow[]): HrOrgChartData {
  const nodes = new Map<string, OrgChartNode>(), parents = new Map<string, string | null>(), ordering = new Map<string, number>()
  for (const d of departments) {
    if (nodes.has(d.id)) throw new Error('Duplicate department')
    nodes.set(d.id, { department: { id: d.id, name: d.name, code: d.code, managerId: d.managerId }, employees: [], children: [] }); ordering.set(d.id, d.sortOrder)
  }
  let hierarchyWarning = false
  for (const d of departments) parents.set(d.id, d.parentId && nodes.has(d.parentId) ? d.parentId : null)
  const completed = new Set<string>()
  for (const start of [...nodes.keys()].sort()) {
    let current: string | null = start
    const trail: string[] = [], visited = new Set<string>()
    while (current && !completed.has(current)) {
      if (visited.has(current)) { parents.set(current, null); hierarchyWarning = true; break }
      visited.add(current); trail.push(current); current = parents.get(current) || null
    }
    for (const id of trail) completed.add(id)
  }
  const roots: OrgChartNode[] = [], unassignedEmployees: Employee[] = [], employeeIds = new Set<string>()
  for (const [id, node] of nodes) {
    const parent = parents.get(id)
    if (parent) nodes.get(parent)!.children.push(node)
    else roots.push(node)
  }
  for (const row of employees) {
    if (employeeIds.has(row.id)) throw new Error('Duplicate employee')
    employeeIds.add(row.id)
    const { departmentId, ...employee } = row
    const department = departmentId ? nodes.get(departmentId) : undefined
    if (department) department.employees.push(employee)
    else unassignedEmployees.push(employee)
  }
  const departmentOrder = (a: OrgChartNode, b: OrgChartNode) => (ordering.get(a.department.id)! - ordering.get(b.department.id)!) || a.department.id.localeCompare(b.department.id)
  const employeeOrder = (a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName, 'ja') || a.firstName.localeCompare(b.firstName, 'ja') || a.id.localeCompare(b.id)
  roots.sort(departmentOrder); unassignedEmployees.sort(employeeOrder)
  for (const node of nodes.values()) { node.children.sort(departmentOrder); node.employees.sort(employeeOrder) }
  return { orgName, orgChart: roots, unassignedEmployees, hierarchyWarning }
}

export async function readHrOrgChart(signal: AbortSignal, progress?: (loaded: number, total: number) => void): Promise<HrOrgChartData> {
  const departments: Department[] = [], employees: EmployeeRow[] = [], departmentIds = new Set<string>(), employeeIds = new Set<string>(), cursors = new Set<string>()
  let cursor: string | null = null, revision: string | undefined, orgName: string | undefined, totals: { departments: number; employees: number } | undefined
  do {
    const page = await readPage(signal, cursor)
    if (signal.aborted) throw new Error('HR org chart read cancelled')
    if (revision && (page.revision !== revision || page.orgName !== orgName || page.totals.departments !== totals!.departments || page.totals.employees !== totals!.employees)) throw new HrOrgChartReadError(false, true)
    revision = page.revision; orgName = page.orgName; totals = page.totals
    for (const row of page.departments) { if (departmentIds.has(row.id)) throw new Error('Duplicate department across pages'); departmentIds.add(row.id); departments.push(row) }
    for (const row of page.employees) { if (employeeIds.has(row.id)) throw new Error('Duplicate employee across pages'); employeeIds.add(row.id); employees.push(row) }
    if (departments.length > totals.departments || employees.length > totals.employees) throw new Error('HR org chart totals invalid')
    cursor = page.nextCursor
    if (cursor) {
      if (cursors.has(cursor) || page.departments.length + page.employees.length === 0 || (departments.length === totals.departments && employees.length === totals.employees)) throw new Error('HR org chart cursor did not advance')
      cursors.add(cursor)
    } else if (departments.length !== totals.departments || employees.length !== totals.employees) throw new Error('HR org chart incomplete')
    progress?.(departments.length + employees.length, totals.departments + totals.employees)
  } while (cursor)
  return assembleHrOrgChart(orgName || '', departments, employees)
}
