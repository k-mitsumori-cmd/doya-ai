import type { DepartmentHierarchyRow } from '@/lib/hr/department-hierarchy'

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalid = (): never => { throw Error('部署一覧の応答を確認できませんでした。再取得してください。') }
function parseRow(value: unknown): DepartmentHierarchyRow {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'code,employeeCount,id,isActive,managerId,name,parentId,sortOrder' ||
    typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() ||
    !['code', 'parentId', 'managerId'].every(k => value[k] === null || typeof value[k] === 'string') ||
    !Number.isInteger(value.sortOrder) || (value.sortOrder as number) < -2147483648 || (value.sortOrder as number) > 2147483647 ||
    typeof value.isActive !== 'boolean' || !Number.isSafeInteger(value.employeeCount) || (value.employeeCount as number) < 0) return invalid()
  return value as unknown as DepartmentHierarchyRow
}

/** Accumulate complete records only; nothing is shown as an empty/successful list until all pages validate. */
export function createDepartmentListReader(expectedOrganization?: string) {
  let organizationId = expectedOrganization, revision: string | undefined, total: number | undefined
  const rows: DepartmentHierarchyRow[] = [], ids = new Set<string>(), cursors = new Set<string>()
  let pending: { id: string; offset: number; text: string[] } | null = null, done = false
  return {
    accept(value: unknown) {
      if (done || !object(value) || value.success !== true || value.format !== 'hr-department-page-v1' ||
        typeof value.organizationId !== 'string' || !value.organizationId ||
        typeof value.revision !== 'string' || !/^[a-f0-9]{64}$/.test(value.revision) ||
        !Number.isSafeInteger(value.total) || (value.total as number) < 0 ||
        !Array.isArray(value.fragments) || value.fragments.length > 50 ||
        !(value.nextCursor === null || (typeof value.nextCursor === 'string' && /^[a-zA-Z0-9_-]{1,16384}$/.test(value.nextCursor))) ||
        Object.keys(value).sort().join(',') !== 'format,fragments,nextCursor,organizationId,revision,success,total') return invalid()
      organizationId ??= value.organizationId; revision ??= value.revision; total ??= value.total as number
      if (organizationId !== value.organizationId || revision !== value.revision || total !== value.total) return invalid()
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
      return { organizationId, rows: [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)) }
    },
  }
}

async function readPage(url: string, organizationId: string | undefined, signal?: AbortSignal) {
  const controller = new AbortController(), abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 35000)
  let stoppedAbort: (() => void) | undefined
  const stopped = new Promise<never>((_, reject) => {
    stoppedAbort = () => reject(Error('部署一覧の取得が中断されました。再取得してください。'))
    controller.signal.addEventListener('abort', stoppedAbort, { once: true })
  })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const response = await Promise.race([stopped, fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal,
      ...(organizationId ? { headers: { 'X-HR-Organization-Id': organizationId } } : {}) })])
    if (response.status !== 200) throw Error(response.status === 401 ? 'ログイン状態を確認してください。' : response.status === 409 ?
      '部署が更新されました。部署一覧を再取得してください。' : '部署一覧を取得できませんでした。再取得してください。')
    if (!response.body) return invalid()
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      if (controller.signal.aborted) throw Error('部署一覧の取得が中断されました。再取得してください。')
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
export async function loadHrDepartmentList(signal?: AbortSignal, expectedOrganization?: string) {
  const reader = createDepartmentListReader(expectedOrganization)
  let cursor: string | null = null
  do {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const data = await readPage('/api/hr/departments?format=pages' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), reader.organizationId(), signal)
    if (signal?.aborted) throw Error('操作が中断されました。')
    cursor = reader.accept(data)
  } while (cursor !== null)
  return reader.finish()
}
