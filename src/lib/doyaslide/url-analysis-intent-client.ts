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
async function locked<T>(actor: string, signal: AbortSignal, action: () => T): Promise<T> {
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
      return action()
    }), stopped])
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); controller.abort() }
}
export async function claimUrlAnalysisIntent(actor: string, signal: AbortSignal): Promise<{ intent: UrlAnalysisIntent; created: boolean }> {
  return locked(actor, signal, () => {
    const previous = readUrlAnalysisIntent(actor)
    if (previous) return { intent: previous, created: false }
    const intent: UrlAnalysisIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString() }
    if (!validIntent(intent)) throw new Error(guidance)
    localStorage.setItem(storageKey(actor), JSON.stringify(intent))
    if (readUrlAnalysisIntent(actor)?.operationId !== intent.operationId) throw new Error(guidance)
    return { intent, created: true }
  })
}
/** Call only after applying a completed proposal or confirming a terminal cancellation/failure. */
export async function clearUrlAnalysisIntent(actor: string, operationId: string, signal: AbortSignal): Promise<void> {
  return locked(actor, signal, () => {
    if (!uuid.test(operationId) || readUrlAnalysisIntent(actor)?.operationId !== operationId) throw new Error(guidance)
    localStorage.removeItem(storageKey(actor))
    if (readUrlAnalysisIntent(actor) !== null) throw new Error(guidance)
  })
}
