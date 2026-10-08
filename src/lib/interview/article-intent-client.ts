/** Only operation identity is persisted. Article text and private instructions never enter storage. */
import type { ArticleIntentScope } from './article-operation-client'
export type ArticleIntent = { version: 1; operationId: string; createdAt: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const guidance = '前の記事生成の結果を確認してください。新しい生成は開始していません。'
function storageKey(scope: ArticleIntentScope) {
  if (!/^[a-f0-9]{64}$/.test(scope.actorScope) || !/^[A-Za-z0-9_-]{1,128}$/.test(scope.projectId)) throw new Error('ログイン情報を確認してください。')
  return 'interview-article-intent:v1:' + scope.actorScope + ':' + encodeURIComponent(scope.projectId)
}
function validIntent(value: unknown): value is ArticleIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as ArticleIntent
  return row.version === 1 && typeof row.operationId === 'string' && uuid.test(row.operationId)
    && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && Object.keys(row).every(key => ['version', 'operationId', 'createdAt'].includes(key))
}
export function readArticleIntent(scope: ArticleIntentScope): ArticleIntent | null {
  const raw = localStorage.getItem(storageKey(scope))
  if (raw === null) return null
  try {
    if (raw.length > 2048) throw new Error()
    const value: unknown = JSON.parse(raw)
    if (!validIntent(value)) throw new Error()
    return value
  } catch { throw new Error('保存された記事生成情報を確認できません。新しく生成せずお問い合わせください。') }
}
/** The lock covers metadata mutation, not network I/O, so recovery/cancellation can proceed during a slow POST. */
async function locked<T>(scope: ArticleIntentScope, signal: AbortSignal, action: () => T): Promise<T> {
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
export async function claimArticleIntent(scope: ArticleIntentScope, signal: AbortSignal): Promise<{ intent: ArticleIntent; created: boolean }> {
  return locked(scope, signal, () => {
    const previous = readArticleIntent(scope)
    if (previous) return { intent: previous, created: false }
    const intent: ArticleIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString() }
    if (!validIntent(intent)) throw new Error(guidance)
    localStorage.setItem(storageKey(scope), JSON.stringify(intent))
    if (readArticleIntent(scope)?.operationId !== intent.operationId) throw new Error(guidance)
    return { intent, created: true }
  })
}
/** Call only after applying a completed article or confirming a terminal cancellation/failure. */
export async function clearArticleIntent(scope: ArticleIntentScope, operationId: string, signal: AbortSignal): Promise<void> {
  return locked(scope, signal, () => {
    if (!uuid.test(operationId) || readArticleIntent(scope)?.operationId !== operationId) throw new Error(guidance)
    localStorage.removeItem(storageKey(scope))
    if (readArticleIntent(scope) !== null) throw new Error(guidance)
  })
}
