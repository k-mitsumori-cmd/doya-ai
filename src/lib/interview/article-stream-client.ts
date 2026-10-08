import { readArticleOperationResponse, type ArticleOperationView } from './article-operation-client'

/** Client acknowledgement reader. A broken connection never proves a failed save. */
export type ArticleStreamEvent =
  | { type: 'operation'; operation: ArticleOperationView }
  | { type: 'progress'; step: string }
  | { type: 'chunk'; text: string }
  | { type: 'done'; draftId: string; wordCount: number; version: number }
  | { type: 'error'; message: string; code?: string; upgradePath?: string; contactUrl?: string }

export class ArticleStreamError extends Error {
  constructor(public readonly kind: 'cancelled' | 'unknown' | 'login') {
    super(kind === 'cancelled' ? '生成の受信を停止しました。保存状況は記事一覧で確認してください。'
      : kind === 'login' ? 'ログイン状態を確認し、記事一覧で保存状況を確認してください。'
        : '生成結果を確認できません。再生成する前に記事一覧で保存状況を確認してください。')
    this.name = 'ArticleStreamError'
  }
}

const MAX_BODY = 8 * 1024 * 1024
const MAX_EVENT = 512 * 1024
const MAX_TEXT = 512 * 1024

function parseEvent(raw: string): ArticleStreamEvent {
  let row: Record<string, unknown>
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    row = value as Record<string, unknown>
  } catch { throw new ArticleStreamError('unknown') }
  if (row.type === 'progress' && typeof row.step === 'string' && row.step.length <= 2000) return { type: 'progress', step: row.step }
  if (row.type === 'chunk' && typeof row.text === 'string' && row.text.length <= MAX_TEXT) return { type: 'chunk', text: row.text }
  if (row.type === 'done' && typeof row.draftId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(row.draftId)
    && Number.isSafeInteger(row.wordCount) && (row.wordCount as number) >= 0 && (row.wordCount as number) <= MAX_TEXT
    && Number.isSafeInteger(row.version) && (row.version as number) >= 1) {
    return { type: 'done', draftId: row.draftId, wordCount: row.wordCount as number, version: row.version as number }
  }
  if (row.type === 'error' && typeof row.message === 'string' && row.message.length <= 2000
    && ['code', 'upgradePath', 'contactUrl'].every(key => row[key] === undefined || (typeof row[key] === 'string' && (row[key] as string).length <= 2000))) {
    // Error strings come from this first-party route, never from raw provider diagnostics.
    return { type: 'error', message: row.message, ...(typeof row.code === 'string' ? { code: row.code } : {}),
      ...(typeof row.upgradePath === 'string' ? { upgradePath: row.upgradePath } : {}),
      ...(typeof row.contactUrl === 'string' ? { contactUrl: row.contactUrl } : {}) }
  }
  throw new ArticleStreamError('unknown')
}

/** One POST, one total deadline, first validated terminal event only. No retry. */
export async function readArticleGeneration(
  input: { projectId: string; recipeId: string; displayFormat: string; customInstructions?: string; operationId: string; actorScope: string },
  signal: AbortSignal,
  onEvent: (event: ArticleStreamEvent) => void,
): Promise<Extract<ArticleStreamEvent, { type: 'done' | 'error' | 'operation' }>> {
  if (signal.aborted) throw new ArticleStreamError('cancelled')
  if (!/^[a-f0-9]{64}$/.test(input.actorScope) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.operationId)) throw new ArticleStreamError('unknown')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let rejectStop!: (error: ArticleStreamError) => void
  const stop = new Promise<never>((_, reject) => { rejectStop = reject })
  const cancel = () => { controller.abort(); rejectStop(new ArticleStreamError('cancelled')) }
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => { controller.abort(); rejectStop(new ArticleStreamError('unknown')) }, 310_000)
  const work = (async () => {
    const response = await fetch('/api/interview/articles/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, actorScope: undefined }),
      signal: controller.signal, cache: 'no-store',
    })
    if (controller.signal.aborted) throw new ArticleStreamError('cancelled')
    if (response.status === 401) throw new ArticleStreamError('login')
    if (input.operationId && input.actorScope) {
      if ((response.headers.get('content-type') || '').includes('application/json')) {
        const operation = await readArticleOperationResponse(response, { actorScope: input.actorScope, projectId: input.projectId }, input.operationId, controller.signal)
        if (controller.signal.aborted) throw new ArticleStreamError('cancelled')
        const event = { type: 'operation' as const, operation }; onEvent(event); return event
      }
      if (response.headers.get('x-article-operation-id') !== input.operationId || response.headers.get('x-article-actor-scope') !== input.actorScope) throw new ArticleStreamError('unknown')
    }

    if (!response.ok || !response.body || !/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '')
      || Number(response.headers.get('content-length')) > MAX_BODY) throw new ArticleStreamError('unknown')
    reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let buffer = '', bytes = 0, textLength = 0
    const consume = (): Extract<ArticleStreamEvent, { type: 'done' | 'error' }> | undefined => {
      // CRLF may be split across network chunks; normalize only complete frames.
      while (true) {
        const boundary = /\r?\n\r?\n/.exec(buffer)
        if (!boundary) {
          if (buffer.length > MAX_EVENT) throw new ArticleStreamError('unknown')
          return
        }
        const frame = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        if (frame.length > MAX_EVENT) throw new ArticleStreamError('unknown')
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
        if (!data) continue // comments/keepalive
        const event = parseEvent(data)
        if (event.type === 'chunk') {
          textLength += event.text.length
          if (textLength > MAX_TEXT) throw new ArticleStreamError('unknown')
        }
        if (controller.signal.aborted) throw new ArticleStreamError('cancelled')
        onEvent(event)
        if (event.type === 'done' || event.type === 'error') return event
      }
    }
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new ArticleStreamError('cancelled')
      if (chunk.done) {
        buffer += decoder.decode()
        const terminal = consume()
        if (terminal) return terminal
        throw new ArticleStreamError('unknown')
      }
      bytes += chunk.value.byteLength
      if (bytes > MAX_BODY) throw new ArticleStreamError('unknown')
      buffer += decoder.decode(chunk.value, { stream: true })
      const terminal = consume()
      if (terminal) return terminal
    }
  })()
  try { return await Promise.race([work, stop]) }
  catch (error) { throw error instanceof ArticleStreamError ? error : new ArticleStreamError(signal.aborted ? 'cancelled' : 'unknown') }
  finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
