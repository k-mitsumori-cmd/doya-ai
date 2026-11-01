export type ArticleIntentScope = { actorScope: string; projectId: string }
export type ArticleOperationView = {
  operationId: string; actorScope: string; state: 'pending' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'missing' | 'busy'
  result: { draftId: string; wordCount: number; version: number } | null
  code: 'ARTICLE_LIMIT' | 'GENERATION_FAILED' | 'OPERATION_EXPIRED' | null
  limit: number | null; message?: string; upgradePath?: string; contactUrl?: string
}
export class ArticleProtocolError extends Error {
  constructor(readonly kind: 'unknown' | 'login' | 'cancelled' = 'unknown') {
    super(kind === 'login' ? 'ログイン状態を確認し、保存済みの記事を確認してください。' : '処理状況を確認できません。新しく生成せず、結果を再確認してください。')
  }
}
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v)
export function validArticleScope(scope: ArticleIntentScope) { return /^[a-f0-9]{64}$/.test(scope.actorScope) && id(scope.projectId) }

async function jsonBody(response: Response, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (response.status === 401) throw new ArticleProtocolError('login')
  if (!response.body || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > 65_536) throw new ArticleProtocolError()
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  const cancel = () => { try { void reader.cancel().catch(() => {}) } catch {} }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    if (signal.aborted) throw new ArticleProtocolError('cancelled')
    while (true) {
      const chunk = await reader.read()
      if (signal.aborted) throw new ArticleProtocolError('cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 65_536) throw new ArticleProtocolError()
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ArticleProtocolError()
    return value as Record<string, unknown>
  } finally { signal.removeEventListener('abort', cancel); cancel() }
}
/** Called inside the caller's header-to-body deadline. No fetch or retry here. */
export async function readArticleOperationResponse(response: Response, scope: ArticleIntentScope, operationId: string, signal: AbortSignal): Promise<ArticleOperationView> {
  if (!validArticleScope(scope) || !uuid(operationId)) throw new ArticleProtocolError()
  const row = await jsonBody(response, signal)
  if (row.operationId !== operationId || row.actorScope !== scope.actorScope || row.error !== undefined) throw new ArticleProtocolError()
  const r = row as unknown as ArticleOperationView
  if (!['pending', 'cancelling', 'completed', 'failed', 'cancelled', 'missing', 'busy'].includes(r.state)
    || ![null, 'ARTICLE_LIMIT', 'GENERATION_FAILED', 'OPERATION_EXPIRED'].includes(r.code)
    || !(r.limit === null || [2, 5, 10, 30, 100].includes(r.limit))) throw new ArticleProtocolError()
  const status = ['pending', 'cancelling'].includes(r.state) ? 202 : r.state === 'busy' ? 409 : r.state === 'failed' ? r.code === 'ARTICLE_LIMIT' ? 429 : 400 : 200
  if (response.status !== status) throw new ArticleProtocolError()
  if (r.state === 'completed') {
    const result = r.result
    if (!result || typeof result !== 'object' || Array.isArray(result) || !id(result.draftId)
      || !Number.isSafeInteger(result.wordCount) || result.wordCount < 0 || result.wordCount > 512 * 1024
      || !Number.isSafeInteger(result.version) || result.version < 1 || r.code !== null || r.limit === null
      || Object.keys(result).some(k => !['draftId', 'wordCount', 'version'].includes(k))) throw new ArticleProtocolError()
  } else if (r.result !== null) throw new ArticleProtocolError()
  if (r.state === 'failed' ? r.code === null || r.limit === null : r.code !== null) throw new ArticleProtocolError()
  if (['pending', 'cancelling'].includes(r.state) && r.limit === null) throw new ArticleProtocolError()
  if (['missing', 'busy'].includes(r.state) && r.limit !== null) throw new ArticleProtocolError()
  if (r.code === 'ARTICLE_LIMIT') {
    if (typeof r.message !== 'string' || r.message.length > 2000
      || (r.upgradePath === undefined) === (r.contactUrl === undefined)
      || (r.upgradePath !== undefined && r.upgradePath !== '/interview/pricing')
      || (r.contactUrl !== undefined && (typeof r.contactUrl !== 'string' || r.contactUrl.length > 2000))) throw new ArticleProtocolError()
  } else if (r.message !== undefined || r.upgradePath !== undefined || r.contactUrl !== undefined) throw new ArticleProtocolError()
  if (Object.keys(row).some(k => !['operationId', 'actorScope', 'state', 'result', 'code', 'limit', 'message', 'upgradePath', 'contactUrl'].includes(k))) throw new ArticleProtocolError()
  return r
}
async function bounded<T>(signal: AbortSignal, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (signal.aborted) throw new ArticleProtocolError('cancelled')
  const controller = new AbortController(); let rejectStop!: (e: ArticleProtocolError) => void
  const stop = new Promise<never>((_, reject) => { rejectStop = reject })
  const cancel = () => { controller.abort(); rejectStop(new ArticleProtocolError('cancelled')) }
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => { controller.abort(); rejectStop(new ArticleProtocolError()) }, 30_000)
  try { return await Promise.race([action(controller.signal), stop]) }
  catch (error) { throw error instanceof ArticleProtocolError ? error : new ArticleProtocolError(signal.aborted ? 'cancelled' : 'unknown') }
  finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort() }
}
export async function getArticleActorScope(projectId: string, signal: AbortSignal): Promise<ArticleIntentScope> {
  if (!id(projectId)) throw new ArticleProtocolError()
  return bounded(signal, async current => {
    const response = await fetch('/api/interview/articles/generate?projectId=' + encodeURIComponent(projectId), { cache: 'no-store', signal: current })
    if (current.aborted) throw new ArticleProtocolError('cancelled')
    const row = await jsonBody(response, current)
    if (response.status !== 200 || row.projectId !== projectId || typeof row.actorScope !== 'string'
      || !/^[a-f0-9]{64}$/.test(row.actorScope) || Object.keys(row).some(k => !['projectId', 'actorScope'].includes(k))) throw new ArticleProtocolError()
    return { projectId, actorScope: row.actorScope }
  })
}
export async function readArticleOperation(scope: ArticleIntentScope, operationId: string, method: 'GET' | 'DELETE', signal: AbortSignal): Promise<ArticleOperationView> {
  if (!validArticleScope(scope) || !uuid(operationId)) throw new ArticleProtocolError()
  return bounded(signal, async current => {
    const response = await fetch('/api/interview/articles/generate?projectId=' + encodeURIComponent(scope.projectId) + '&operationId=' + encodeURIComponent(operationId), { method, cache: 'no-store', signal: current })
    if (current.aborted) throw new ArticleProtocolError('cancelled')
    return readArticleOperationResponse(response, scope, operationId, current)
  })
}
