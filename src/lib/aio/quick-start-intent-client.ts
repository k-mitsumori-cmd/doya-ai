/** Persist operation metadata only. Private URLs and generated content never enter storage. */
type AioStartIntentScope = { actor: string }
export type AioStartIntent = { version: 1; operationId: string; createdAt: string; hostHash: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const guidance = '前の開始処理の保存状況を確認してください。新しい作成は開始していません。'
function storageKey(scope: AioStartIntentScope) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scope.actor)) throw new Error('ログイン情報を確認してください。')
  return 'aio-quick-start-intent:v1:' + scope.actor
}
function validIntent(value: unknown): value is AioStartIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as AioStartIntent
  return row.version === 1 && typeof row.operationId === 'string' && uuid.test(row.operationId)
    && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && typeof row.hostHash === 'string' && /^[a-f0-9]{64}$/.test(row.hostHash)
    && Object.keys(row).every(key => ['version', 'operationId', 'createdAt', 'hostHash'].includes(key))
}
export function readAioStartIntent(scope: AioStartIntentScope): AioStartIntent | null {
  const raw = localStorage.getItem(storageKey(scope))
  if (raw === null) return null
  try {
    if (raw.length > 2048) throw new Error()
    const value: unknown = JSON.parse(raw)
    if (!validIntent(value)) throw new Error()
    return value
  } catch { throw new Error('保存された開始処理の情報を確認できません。新しく開始せずお問い合わせください。') }
}

/** Keep private paths/query strings out of browser storage. Match the server host policy. */
export async function aioStartHostHash(raw: string): Promise<string> {
  const value = raw.trim(), url = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value)
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('有効なURLを入力してください。')
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(host))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
/** The lock covers metadata mutation, not network I/O, so recovery/cancellation can proceed during a slow POST. */
async function locked<T>(scope: AioStartIntentScope, signal: AbortSignal, action: () => T): Promise<T> {
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
export async function claimAioStartIntent(scope: AioStartIntentScope, hostHash: string, signal: AbortSignal): Promise<{ intent: AioStartIntent; created: boolean }> {
  return locked(scope, signal, () => {
    const previous = readAioStartIntent(scope)
    if (previous) return { intent: previous, created: false }
    const intent: AioStartIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString(), hostHash }
    if (!validIntent(intent)) throw new Error(guidance)
    localStorage.setItem(storageKey(scope), JSON.stringify(intent))
    if (readAioStartIntent(scope)?.operationId !== intent.operationId) throw new Error(guidance)
    return { intent, created: true }
  })
}
/** Call only after applying a completed extraction or confirming a terminal cancellation/failure. */
export async function clearAioStartIntent(scope: AioStartIntentScope, operationId: string, signal: AbortSignal): Promise<void> {
  return locked(scope, signal, () => {
    if (!uuid.test(operationId) || readAioStartIntent(scope)?.operationId !== operationId) throw new Error(guidance)
    localStorage.removeItem(storageKey(scope))
    if (readAioStartIntent(scope) !== null) throw new Error(guidance)
  })
}
