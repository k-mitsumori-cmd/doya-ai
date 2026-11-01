import type { OrgChartNode } from '@/lib/hr/types'

export class HrOrgChartReadError extends Error {
  constructor(readonly unauthorized = false) { super('HR org chart read failed') }
}

type Employee = OrgChartNode['employees'][number]
export type HrOrgChartData = { orgName: string; orgChart: OrgChartNode[]; unassignedEmployees: Employee[] }

export function parseHrOrgChart(value: unknown): HrOrgChartData {
  const object = (input: unknown): input is Record<string, unknown> => Boolean(input) && typeof input === 'object' && !Array.isArray(input)
  const text = (input: unknown, limit = 1024): input is string => typeof input === 'string' && input.length <= limit
  const nullableText = (input: unknown, limit = 1024) => input === null || text(input, limit)
  const id = (input: unknown): input is string => typeof input === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(input)
  const employees = new Set<string>(), departments = new Set<string>()
  let count = 0
  const fail = (): never => { throw new Error('HR org chart response invalid') }
  const employee = (input: unknown): Employee => {
    if (!object(input) || !id(input.id) || employees.has(input.id) || !text(input.firstName) || !text(input.lastName) || !nullableText(input.position) || !nullableText(input.photoUrl, 8192) || !nullableText(input.employeeNumber)) return fail()
    if (++count > 10000) return fail()
    employees.add(input.id)
    return { id: input.id, firstName: input.firstName, lastName: input.lastName, position: input.position as string | null, photoUrl: input.photoUrl as string | null, employeeNumber: input.employeeNumber as string | null }
  }
  const nodes = (input: unknown, depth: number): OrgChartNode[] => {
    if (!Array.isArray(input) || depth > 64) return fail()
    return input.map(row => {
      if (!object(row) || !object(row.department)) return fail()
      const d = row.department
      if (!id(d.id) || departments.has(d.id) || !text(d.name) || !nullableText(d.code) || !(d.managerId === null || id(d.managerId)) || !Array.isArray(row.employees)) return fail()
      if (++count > 10000) return fail()
      departments.add(d.id)
      return { department: { id: d.id, name: d.name, code: d.code as string | null, managerId: d.managerId as string | null }, employees: row.employees.map(employee), children: nodes(row.children, depth + 1) }
    })
  }
  if (!object(value) || value.success !== true || !text(value.orgName) || !Array.isArray(value.unassignedEmployees)) return fail()
  const orgChart = nodes(value.orgChart, 0)
  return { orgName: value.orgName, orgChart, unassignedEmployees: value.unassignedEmployees.map(employee) }
}

/** A chart can be larger than billing metadata. Bound the entire read, including stalled bodies. */
export async function readHrOrgChart(signal: AbortSignal): Promise<HrOrgChartData> {
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
    const response = await fetch('/api/hr/org-chart', { method: 'GET', cache: 'no-store', signal: controller.signal })
    if (response.status === 401) throw new HrOrgChartReadError(true)
    if (response.status !== 200 || controller.signal.aborted || !response.body || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('HR org chart read failed')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new Error('HR org chart read cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 1024 * 1024) throw new Error('HR org chart response too large')
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return parseHrOrgChart(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  })()
  try { return await Promise.race([work, stop]) } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
