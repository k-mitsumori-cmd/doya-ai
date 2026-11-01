/** Only operation identity is persisted. URLs, source text and drafts stay out of browser storage. */
export type UrlAnalysisIntent = { version: 1; operationId: string; createdAt: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const guidance = '前の取り込み結果を確認してください。新しい解析は開始していません。'
function storageKey(actor: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(actor)) throw new Error('ログイン情報を確認してください。')
  return 'doyaslide-url-intent:v1:' + encodeURIComponent(actor)
}
function validIntent(value: unknown): value is UrlAnalysisIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as UrlAnalysisIntent
  return row.version === 1 && typeof row.operationId === 'string' && uuid.test(row.operationId)
    && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && Object.keys(row).every(key => ['version', 'operationId', 'createdAt'].includes(key))
}
export function readUrlAnalysisIntent(actor: string): UrlAnalysisIntent | null {
  const raw = localStorage.getItem(storageKey(actor))
  if (raw === null) return null
  try {
    if (raw.length > 2048) throw new Error()
    const value: unknown = JSON.parse(raw)
    if (!validIntent(value)) throw new Error()
    return value
  } catch { throw new Error('保存された取り込み情報を確認できません。新しい解析をせずお問い合わせください。') }
}
/** The lock covers metadata mutation, not network I/O, so recovery/cancellation can proceed during a slow POST. */
async function locked<T>(actor: string, signal: AbortSignal, action: (lockSignal: AbortSignal) => T): Promise<T> {
  const key = storageKey(actor)
  if (signal.aborted || typeof navigator === 'undefined' || !navigator.locks) throw new Error(guidance)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop = () => {}
  const stopped = new Promise<never>((_, reject) => {
    stop = () => { controller.abort(); reject(new Error(guidance)) }
    signal.addEventListener('abort', stop, { once: true })
    timer = setTimeout(stop, 10000)
  })
  try {
    return await Promise.race([navigator.locks.request(key, { mode: 'exclusive', signal: controller.signal }, () => {
      // Also guard a noncooperative/queued lock callback after timeout or actor unmount.
      if (signal.aborted || controller.signal.aborted) throw new Error(guidance)
      return action(controller.signal)
    }), stopped])
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); controller.abort() }
}
/** IndexedDB serializes the durable decision across renderer processes; localStorage is only the UI mirror. */
function mutateIntent<T>(actor: string, signal: AbortSignal, mutate: (previous: UrlAnalysisIntent | null) => { next: UrlAnalysisIntent | null; result: T }): Promise<T> {
  const key = storageKey(actor)
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted || typeof indexedDB === 'undefined') { reject(new Error(guidance)); return }
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let settled = false
    let result: T
    let failure: unknown
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', stop)
      database?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const stop = () => {
      try { transaction?.abort() } catch { /* Already terminal. */ }
      finish(new Error(guidance))
    }
    const timer = setTimeout(stop, 10000)
    signal.addEventListener('abort', stop, { once: true })
    let request: IDBOpenDBRequest
    try { request = indexedDB.open('doyaslide-url-operations-v1', 1) }
    catch (error) { finish(error); return }
    request.onupgradeneeded = () => {
      if (settled || signal.aborted) { request.transaction?.abort(); return }
      request.result.createObjectStore('intents')
    }
    request.onblocked = () => finish(new Error(guidance))
    request.onerror = () => finish(request.error || new Error(guidance))
    request.onsuccess = () => {
      database = request.result
      if (settled || signal.aborted) { database.close(); finish(new Error(guidance)); return }
      database.onversionchange = () => { stop(); database?.close() }
      try {
        transaction = database.transaction('intents', 'readwrite')
        const store = transaction.objectStore('intents')
        transaction.onabort = () => finish(failure || transaction?.error || new Error(guidance))
        transaction.onerror = () => { failure ||= transaction?.error || new Error(guidance) }
        transaction.oncomplete = () => finish(signal.aborted ? new Error(guidance) : undefined)
        const read = store.get(key)
        read.onsuccess = () => {
          try {
            if (settled || signal.aborted) throw new Error(guidance)
            // Validate the old mirror even after migration; corrupt metadata must not be silently discarded.
            const legacy = readUrlAnalysisIntent(actor)
            const value: unknown = read.result
            if (value !== undefined && value !== null && !validIntent(value)) throw new Error(guidance)
            const previous = value === undefined || value === null ? legacy : value as UrlAnalysisIntent
            const update = mutate(previous)
            if (update.next) localStorage.setItem(key, JSON.stringify(update.next))
            else localStorage.removeItem(key)
            if (readUrlAnalysisIntent(actor)?.operationId !== update.next?.operationId) throw new Error(guidance)
            // Retain only metadata. A valid legacy mirror can still recover an old receipt without admitting a new POST.
            store.put(update.next, key)
            result = update.result
          } catch (error) {
            failure = error
            try { transaction?.abort() } catch { finish(error) }
          }
        }
      } catch (error) { finish(error) }
    }
  })
}
export async function claimUrlAnalysisIntent(actor: string, signal: AbortSignal): Promise<{ intent: UrlAnalysisIntent; created: boolean }> {
  return locked(actor, signal, lockSignal => mutateIntent(actor, lockSignal, previous => {
    if (previous) return { next: previous, result: { intent: previous, created: false } }
    const intent: UrlAnalysisIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString() }
    if (!validIntent(intent)) throw new Error(guidance)
    return { next: intent, result: { intent, created: true } }
  }))
}
/** Call only after applying a completed proposal or confirming a terminal cancellation/failure. */
export async function clearUrlAnalysisIntent(actor: string, operationId: string, signal: AbortSignal): Promise<void> {
  return locked(actor, signal, lockSignal => mutateIntent(actor, lockSignal, previous => {
    if (!uuid.test(operationId) || previous?.operationId !== operationId) throw new Error(guidance)
    return { next: null, result: undefined }
  }))
}
