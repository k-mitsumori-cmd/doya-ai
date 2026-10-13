export interface EvaluationOverviewPeriod {
  id: string; organizationId: string; name: string; startDate: string; endDate: string; updatedAt: string
  status: string; canManageEvaluations: boolean; evaluationCount: number
}
export interface EvaluationOverviewEmployee {
  id: string; firstName: string; lastName: string; departmentId: string | null
  department: { id: string; name: string } | null
  evaluation: { id: string; status: string } | null
  evaluationUnavailable: boolean
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: string) => Object.keys(value).sort().join(',') === expected
const string = (value: unknown): value is string => typeof value === 'string' && Boolean(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const iso = (value: unknown): value is string => string(value) && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
const invalid = (): never => { throw Error('評価期間の応答を確認できませんでした。再取得してください。') }

/** No period or employee is accepted as visible until every page belongs to one complete snapshot. */
export function createHrEvaluationOverviewReader(periodId: string, expectedOrganization?: string) {
  let organizationId = expectedOrganization, revision: string | undefined, total: number | undefined
  let period: EvaluationOverviewPeriod | null = null, done = false
  let pending: { kind: string; id: string; offset: number; parts: string[] } | null = null
  const employees: EvaluationOverviewEmployee[] = [], ids = new Set<string>(), evaluationIds = new Set<string>(), cursors = new Set<string>()
  return {
    accept(value: unknown) {
      if (done || !object(value) || !keys(value, 'format,fragments,nextCursor,organizationId,periodId,revision,success,totalEmployees') ||
        value.success !== true || value.format !== 'hr-evaluation-period-page-v1' || value.periodId !== periodId ||
        !string(value.organizationId) || !string(value.revision) || !/^[a-f0-9]{64}$/.test(value.revision) || !integer(value.totalEmployees) ||
        !Array.isArray(value.fragments) || value.fragments.length > 50 ||
        !(value.nextCursor === null || string(value.nextCursor) && /^[a-zA-Z0-9_-]{1,16384}$/.test(value.nextCursor))) return invalid()
      organizationId ??= value.organizationId; revision ??= value.revision; total ??= value.totalEmployees
      if (value.organizationId !== organizationId || value.revision !== revision || value.totalEmployees !== total) return invalid()
      let characters = 0
      for (const fragment of value.fragments) {
        if (!object(fragment) || !keys(fragment, 'complete,id,kind,offset,text') || !['period', 'employee'].includes(fragment.kind as string) ||
          !string(fragment.id) || !integer(fragment.offset) || !string(fragment.text) || fragment.text.length > 8192 || typeof fragment.complete !== 'boolean') return invalid()
        characters += fragment.text.length
        if (characters > 65536) return invalid()
        if (!pending) {
          if (fragment.offset !== 0 || (fragment.kind === 'period' ? Boolean(period) || fragment.id !== periodId : !period || ids.has(fragment.id))) return invalid()
          pending = { kind: fragment.kind as string, id: fragment.id, offset: 0, parts: [] }
        }
        if (pending.kind !== fragment.kind || pending.id !== fragment.id || pending.offset !== fragment.offset) return invalid()
        pending.parts.push(fragment.text); pending.offset += fragment.text.length
        if (!fragment.complete) continue
        let record: unknown
        try { record = JSON.parse(pending.parts.join('')) } catch { return invalid() }
        if (!object(record) || record.kind !== pending.kind) return invalid()
        if (pending.kind === 'period') {
          if (!keys(record, 'kind,period') || !object(record.period)) return invalid()
          const row = record.period
          if (!keys(row, 'canManageEvaluations,endDate,evaluationCount,id,name,organizationId,startDate,status,updatedAt') ||
            row.id !== periodId || row.organizationId !== organizationId || !string(row.name) || !iso(row.startDate) || !iso(row.endDate) || !iso(row.updatedAt) ||
            !string(row.status) || typeof row.canManageEvaluations !== 'boolean' || !integer(row.evaluationCount)) return invalid()
          period = row as unknown as EvaluationOverviewPeriod
        } else {
          if (!keys(record, 'employee,kind') || !object(record.employee)) return invalid()
          const row = record.employee
          if (!keys(row, 'department,departmentId,evaluation,evaluationUnavailable,firstName,id,lastName') || row.id !== pending.id ||
            typeof row.firstName !== 'string' || typeof row.lastName !== 'string' || !(row.departmentId === null || string(row.departmentId)) ||
            typeof row.evaluationUnavailable !== 'boolean') return invalid()
          if (row.department !== null && (!object(row.department) || !keys(row.department, 'id,name') || row.department.id !== row.departmentId || !string(row.department.name))) return invalid()
          if (row.department === null && row.departmentId !== null) return invalid()
          if (row.evaluation !== null) {
            if (!object(row.evaluation) || !keys(row.evaluation, 'id,status') || !string(row.evaluation.id) || !string(row.evaluation.status) || row.evaluationUnavailable || evaluationIds.has(row.evaluation.id)) return invalid()
            evaluationIds.add(row.evaluation.id)
          }
          ids.add(pending.id); employees.push(row as unknown as EvaluationOverviewEmployee)
          if (employees.length > total) return invalid()
        }
        pending = null
      }
      if (value.nextCursor !== null) {
        if (!value.fragments.length || cursors.has(value.nextCursor) || period && employees.length === total && !pending) return invalid()
        cursors.add(value.nextCursor)
      } else {
        if (pending || !period || employees.length !== total || evaluationIds.size !== period.evaluationCount) return invalid()
        done = true
      }
      return value.nextCursor as string | null
    },
    organizationId: () => organizationId,
    finish() {
      if (!done || !period || !organizationId) return invalid()
      return { organizationId, period, employees: [...employees].sort((a, b) => a.lastName.localeCompare(b.lastName, 'ja') || a.firstName.localeCompare(b.firstName, 'ja') || a.id.localeCompare(b.id)) }
    },
  }
}

export class HrEvaluationOverviewClientError extends Error {
  constructor(readonly status: number) {
    super(status === 404 ? '評価期間が見つかりません。' : status === 401 ? 'ログイン状態を確認できませんでした。ログインし直してください。' :
      status === 403 ? '評価期間を表示する権限を確認できませんでした。' : status === 409 ? '評価期間や対象者が更新されました。再取得してください。' : '評価期間を取得できませんでした。時間をおいて再取得してください。')
  }
}

async function readPage(url: string, organizationId: string | undefined, signal?: AbortSignal, transport: typeof fetch = fetch) {
  const controller = new AbortController(), abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 35000)
  let stoppedAbort: (() => void) | undefined
  const stopped = new Promise<never>((_, reject) => {
    stoppedAbort = () => reject(Error('評価期間の取得が中断されました。再取得してください。'))
    controller.signal.addEventListener('abort', stoppedAbort, { once: true })
  })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const response = await Promise.race([stopped, transport(url, { method: 'GET', cache: 'no-store', signal: controller.signal,
      ...(organizationId ? { headers: { 'X-HR-Organization-Id': organizationId } } : {}) })])
    if (response.status !== 200) throw new HrEvaluationOverviewClientError(response.status)
    if (!response.body) return invalid()
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      if (controller.signal.aborted) throw Error('評価期間の取得が中断されました。再取得してください。')
      const { value, done } = await Promise.race([stopped, reader.read()])
      if (done) break
      size += value.byteLength
      if (size > 1048576) return invalid()
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let at = 0
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
    if (stoppedAbort) controller.signal.removeEventListener('abort', stoppedAbort)
    controller.abort()
    if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock() }
  }
}

export async function loadHrEvaluationPeriodOverview(periodId: string, signal?: AbortSignal, expectedOrganization?: string, transport: typeof fetch = fetch) {
  const reader = createHrEvaluationOverviewReader(periodId, expectedOrganization)
  let cursor: string | null = null
  do {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const data = await readPage('/api/hr/evaluations/periods/' + encodeURIComponent(periodId) + '?format=overview-pages' +
      (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), reader.organizationId(), signal, transport)
    if (signal?.aborted) throw Error('操作が中断されました。')
    cursor = reader.accept(data)
  } while (cursor !== null)
  return reader.finish()
}
