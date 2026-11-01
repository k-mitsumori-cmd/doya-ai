export type HrEvaluationPeriodListRow = { id: string; name: string; startDate: string; endDate: string; status: string; evaluationCount: number; completedEvaluations: number }

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
export class HrEvaluationPeriodListReadError extends Error { constructor(message: string, public readonly status: number) { super(message) } }
const invalid = (): never => { throw Error('評価期間一覧の応答を確認できませんでした。再取得してください。') }
function parseRow(value: unknown): HrEvaluationPeriodListRow {
  const iso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(new Date(v).getTime()) && new Date(v).toISOString() === v
  if (!object(value) || Object.keys(value).sort().join(',') !== 'completedEvaluations,endDate,evaluationCount,id,name,startDate,status' ||
    typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() ||
    !iso(value.startDate) || !iso(value.endDate) || new Date(value.startDate).getTime() > new Date(value.endDate).getTime() ||
    typeof value.status !== 'string' || !value.status || !Number.isSafeInteger(value.evaluationCount) || (value.evaluationCount as number) < 0 ||
    !Number.isSafeInteger(value.completedEvaluations) || (value.completedEvaluations as number) < 0 || (value.completedEvaluations as number) > (value.evaluationCount as number)) return invalid()
  return value as unknown as HrEvaluationPeriodListRow
}

/** Accumulate complete records only; nothing is shown as an empty/successful list until all pages validate. */
export function createHrEvaluationPeriodListReader(expectedOrganization?: string) {
  let organizationId = expectedOrganization, revision: string | undefined, total: number | undefined, canCreatePeriods: boolean | undefined
  const rows: HrEvaluationPeriodListRow[] = [], ids = new Set<string>(), cursors = new Set<string>()
  let pending: { id: string; offset: number; text: string[] } | null = null, done = false
  return {
    accept(value: unknown) {
      if (done || !object(value) || value.success !== true || typeof value.canCreatePeriods !== 'boolean' || value.format !== 'hr-evaluation-period-page-v1' ||
        typeof value.organizationId !== 'string' || !value.organizationId ||
        typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision) ||
        !Number.isSafeInteger(value.total) || (value.total as number) < 0 ||
        !Array.isArray(value.fragments) || value.fragments.length > 50 ||
        !(value.nextCursor === null || (typeof value.nextCursor === 'string' && /^[a-zA-Z0-9_-]{1,16384}$/.test(value.nextCursor))) ||
        Object.keys(value).sort().join(',') !== 'canCreatePeriods,format,fragments,nextCursor,organizationId,revision,success,total') return invalid()
      organizationId ??= value.organizationId; revision ??= value.revision; total ??= value.total as number; canCreatePeriods ??= value.canCreatePeriods
      if (organizationId !== value.organizationId || revision !== value.revision || total !== value.total || canCreatePeriods !== value.canCreatePeriods) return invalid()
      let characters = 0
      for (const fragment of value.fragments) {
        if (!object(fragment) || Object.keys(fragment).sort().join(',') !== 'complete,id,offset,text' ||
          typeof fragment.id !== 'string' || !fragment.id || !Number.isSafeInteger(fragment.offset) ||
          typeof fragment.text !== 'string' || !fragment.text.length || fragment.text.length > 8192 ||
          typeof fragment.complete !== 'boolean') return invalid()
        characters += fragment.text.length
        if (characters > 65536) return invalid()
        if (!pending) {
          if (fragment.offset !== 0 || ids.has(fragment.id)) return invalid()
          pending = { id: fragment.id, offset: 0, text: [] }
        }
        if (pending.id !== fragment.id || pending.offset !== fragment.offset) return invalid()
        pending.text.push(fragment.text); pending.offset += fragment.text.length
        if (fragment.complete) {
          let parsed: unknown
          try { parsed = JSON.parse(pending.text.join('')) } catch { return invalid() }
          const row = parseRow(parsed)
          if (row.id !== pending.id) return invalid()
          ids.add(row.id); rows.push(row); pending = null
          if (rows.length > total) return invalid()
        }
      }
      if (value.nextCursor !== null) {
        if (!value.fragments.length || cursors.has(value.nextCursor) || (rows.length === total && !pending)) return invalid()
        cursors.add(value.nextCursor)
      } else {
        if (pending || rows.length !== total) return invalid()
        done = true
      }
      return value.nextCursor as string | null
    },
    organizationId: () => organizationId,
    finish() {
      if (!done || !organizationId) return invalid()
      return { organizationId, canCreatePeriods: canCreatePeriods!, rows: [...rows].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime() || a.id.localeCompare(b.id)) }
    },
  }
}

async function readPage(url: string, organizationId: string | undefined, signal?: AbortSignal, transport: typeof fetch = fetch) {
  const controller = new AbortController(), abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 35000)
  let stoppedAbort: (() => void) | undefined
  const stopped = new Promise<never>((_, reject) => {
    stoppedAbort = () => reject(Error('評価期間一覧の取得が中断されました。再取得してください。'))
    controller.signal.addEventListener('abort', stoppedAbort, { once: true })
  })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const response = await Promise.race([stopped, transport(url, { method: 'GET', cache: 'no-store', signal: controller.signal,
      ...(organizationId ? { headers: { 'X-HR-Organization-Id': organizationId } } : {}) }).then(response => {
        if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw Error('操作が中断されました。') }
        return response
      })])
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => {})
      throw new HrEvaluationPeriodListReadError(response.status === 401 ? 'ログイン状態を確認してください。' : response.status === 409 ?
        '評価期間が更新されました。評価期間一覧を再取得してください。' : '評価期間一覧を取得できませんでした。再取得してください。', response.status)
    }
    if (!response.body) return invalid()
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      if (controller.signal.aborted) throw Error('評価期間一覧の取得が中断されました。再取得してください。')
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

/** GET only; any outage, inconsistent snapshot or abort rejects the entire candidate list. */
export async function loadHrEvaluationPeriodList(signal?: AbortSignal, expectedOrganization?: string, transport: typeof fetch = fetch) {
  const reader = createHrEvaluationPeriodListReader(expectedOrganization)
  let cursor: string | null = null
  do {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const data = await readPage('/api/hr/evaluations/periods?format=pages' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), reader.organizationId(), signal, transport)
    if (signal?.aborted) throw Error('操作が中断されました。')
    cursor = reader.accept(data)
  } while (cursor !== null)
  return reader.finish()
}
