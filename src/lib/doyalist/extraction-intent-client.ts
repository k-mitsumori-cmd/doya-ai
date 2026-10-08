/** Persist operation metadata only. Company lists and private search criteria never enter storage. */
type ExtractionIntentScope = { actor: string }
export type ExtractionIntent = { version: 1; operationId: string; createdAt: string; count: number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const guidance = '前の企業抽出の結果を確認してください。新しい生成は開始していません。'
function storageKey(scope: ExtractionIntentScope) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope.actor)) throw new Error('ログイン情報を確認してください。')
  return 'doyalist-extraction-intent:v1:' + scope.actor
}
function validIntent(value: unknown): value is ExtractionIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as ExtractionIntent
  return row.version === 1 && typeof row.operationId === 'string' && uuid.test(row.operationId)
    && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && Number.isSafeInteger(row.count) && row.count >= 1 && row.count <= 10000
    && Object.keys(row).every(key => ['version', 'operationId', 'createdAt', 'count'].includes(key))
}
export function readExtractionIntent(scope: ExtractionIntentScope): ExtractionIntent | null {
  const raw = localStorage.getItem(storageKey(scope))
  if (raw === null) return null
  try {
    if (raw.length > 2048) throw new Error()
    const value: unknown = JSON.parse(raw)
    if (!validIntent(value)) throw new Error()
    return value
  } catch { throw new Error('保存された企業抽出情報を確認できません。新しく生成せずお問い合わせください。') }
}
/** The lock covers metadata mutation, not network I/O, so recovery/cancellation can proceed during a slow POST. */
async function locked<T>(scope: ExtractionIntentScope, signal: AbortSignal, action: () => T): Promise<T> {
  const key = storageKey(scope)
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
      // Also guard a noncooperative/queued lock callback after timeout or scope unmount.
      if (signal.aborted || controller.signal.aborted) throw new Error(guidance)
      return action()
    }), stopped])
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); controller.abort() }
}
export async function claimExtractionIntent(scope: ExtractionIntentScope, count: number, signal: AbortSignal): Promise<{ intent: ExtractionIntent; created: boolean }> {
  return locked(scope, signal, () => {
    const previous = readExtractionIntent(scope)
    if (previous) return { intent: previous, created: false }
    const intent: ExtractionIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString(), count }
    if (!validIntent(intent)) throw new Error(guidance)
    localStorage.setItem(storageKey(scope), JSON.stringify(intent))
    if (readExtractionIntent(scope)?.operationId !== intent.operationId) throw new Error(guidance)
    return { intent, created: true }
  })
}
/** Call only after applying a completed extraction or confirming a terminal cancellation/failure. */
export async function clearExtractionIntent(scope: ExtractionIntentScope, operationId: string, signal: AbortSignal): Promise<void> {
  return locked(scope, signal, () => {
    if (!uuid.test(operationId) || readExtractionIntent(scope)?.operationId !== operationId) throw new Error(guidance)
    localStorage.removeItem(storageKey(scope))
    if (readExtractionIntent(scope) !== null) throw new Error(guidance)
  })
}
