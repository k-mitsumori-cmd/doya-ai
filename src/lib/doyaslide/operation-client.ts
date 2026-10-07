/** Persist metadata only. Prompts, drafts and private image URLs stay in memory. */
export type DoyaSlideIntent = { version: 1; operationId: string; projectId: string; kind: 'batch' | 'regenerate' | 'chat'; slideId?: string; createdAt: string }
export type DoyaSlideResult = {
  operationId?: string; projectId?: string; kind?: DoyaSlideIntent['kind']; state: string
  results?: { slideId: string; imageUrl: string; rawImageUrl: string; version: number; model: string }[]
  errorCount?: number; skipped?: number; deferred?: number; limit?: number; code?: string; error?: string; upgradeUrl?: string
  quota?: { error?: string; upgradeUrl?: string }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const key = (actor: string, projectId: string) => 'doyaslide-intent:v1:' + encodeURIComponent(JSON.stringify([actor, projectId]))
const guidance = '処理結果を確認できません。再生成せず「保存結果を確認」を押してください。'
function validIntent(value: DoyaSlideIntent, projectId: string) {
  return value && value.version === 1 && typeof value.operationId === 'string' && uuid.test(value.operationId)
    && value.projectId === projectId && identifier(projectId) && ['batch', 'regenerate', 'chat'].includes(value.kind)
    && (value.kind === 'batch' ? value.slideId === undefined : identifier(value.slideId))
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && Object.keys(value).every(field => ['version', 'operationId', 'projectId', 'kind', 'slideId', 'createdAt'].includes(field))
}
export function readDoyaSlideIntent(actor: string, projectId: string): DoyaSlideIntent | null {
  if (!identifier(actor) || !identifier(projectId)) throw new Error('ログイン情報と資料を確認してください。')
  const raw = localStorage.getItem(key(actor, projectId))
  if (raw === null) return null
  try {
    if (raw.length > 2048) throw new Error()
    const value: DoyaSlideIntent = JSON.parse(raw)
    if (!validIntent(value, projectId)) throw new Error()
    return value
  } catch { throw new Error('保存された操作情報を確認できません。新しい生成はせずお問い合わせください。') }
}
export function createDoyaSlideIntent(actor: string, projectId: string, kind: DoyaSlideIntent['kind'], slideId?: string): DoyaSlideIntent {
  if (readDoyaSlideIntent(actor, projectId)) throw new Error('前の操作の保存結果を確認してください。')
  const value: DoyaSlideIntent = { version: 1, operationId: crypto.randomUUID(), projectId, kind, ...(slideId ? { slideId } : {}), createdAt: new Date().toISOString() }
  if (!validIntent(value, projectId)) throw new Error('操作内容を確認してください。')
  localStorage.setItem(key(actor, projectId), JSON.stringify(value))
  if (readDoyaSlideIntent(actor, projectId)?.operationId !== value.operationId) throw new Error('操作情報を保存できず、生成を開始していません。')
  return value
}
export function clearDoyaSlideIntent(actor: string, projectId: string, operationId: string) {
  if (readDoyaSlideIntent(actor, projectId)?.operationId !== operationId) throw new Error('保存された操作が変わりました。結果を再確認してください。')
  localStorage.removeItem(key(actor, projectId))
  if (readDoyaSlideIntent(actor, projectId) !== null) throw new Error('操作情報を更新できません。')
}
function validUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192) return false
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
export async function fetchDoyaSlideOperation(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  if (signal.aborted) throw new Error(guidance)
  let abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new Error(guidance))
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
    return await Promise.race([fetch(url, { ...init, signal }), stopped])
  } finally {
    if (abort) signal.removeEventListener('abort', abort)
  }
}
export async function readDoyaSlideOperationResponse(response: Response, intent: DoyaSlideIntent, signal: AbortSignal): Promise<DoyaSlideResult> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new Error(guidance)); signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      timer = setTimeout(abort, 30000)
    })
    const reading = (async () => {
      const maximum = 80 * 1024
      if (Number(response.headers.get('content-length')) > maximum || !response.body) throw new Error(guidance)
      reader = response.body.getReader()
      const chunks: Uint8Array[] = []; let length = 0
      while (true) {
        const part = await reader.read(); if (part.done) break
        length += part.value.byteLength; if (length > maximum) throw new Error(guidance)
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(length); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const data: DoyaSlideResult = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(guidance)
      if (response.status === 403 && data.code === 'LIMIT_REACHED' && Number.isSafeInteger(data.limit) && data.limit! >= 0 && typeof data.error === 'string') {
        return { ...data, state: 'limit', upgradeUrl: data.upgradeUrl === '/doyaslide/pricing' ? data.upgradeUrl : undefined }
      }
      if (data.operationId !== intent.operationId || data.projectId !== intent.projectId || data.kind !== intent.kind) throw new Error(guidance)
      const status = data.state === 'pending' || data.state === 'busy' ? 202 : data.state === 'unavailable' ? 404 : 200
      if (response.status !== status || !['completed', 'pending', 'busy', 'missing', 'failed', 'cancelled', 'empty', 'unavailable'].includes(data.state)) throw new Error(guidance)
      if (data.results !== undefined) {
        const seen = new Set<string>()
        if (!Array.isArray(data.results) || data.results.length > 4 || !data.results.every(result => {
          if (!result || !identifier(result.slideId) || seen.has(result.slideId) || (intent.kind !== 'batch' && result.slideId !== intent.slideId)
            || !validUrl(result.imageUrl) || !validUrl(result.rawImageUrl) || !Number.isSafeInteger(result.version) || result.version < 1
            || typeof result.model !== 'string' || !result.model || result.model.length > 128) return false
          seen.add(result.slideId); return true
        })) throw new Error(guidance)
      }
      if (data.state === 'completed' && !data.results?.length) throw new Error(guidance)
      if (['failed', 'cancelled', 'empty', 'missing', 'unavailable', 'busy'].includes(data.state) && data.results?.length) throw new Error(guidance)
      for (const value of [data.errorCount, data.skipped, data.deferred]) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error(guidance)
      if (['completed', 'pending', 'failed', 'cancelled'].includes(data.state)
        && (![data.errorCount, data.skipped, data.deferred].every(value => Number.isSafeInteger(value) && value! >= 0)
          || !Number.isSafeInteger(data.limit) || data.limit! < -1 || !Array.isArray(data.results)
          || data.errorCount! + data.results.length > 4)) throw new Error(guidance)
      if (data.quota !== undefined && (!data.quota || typeof data.quota !== 'object' || Array.isArray(data.quota)
        || (data.quota.error !== undefined && typeof data.quota.error !== 'string')
        || (data.quota.upgradeUrl !== undefined && data.quota.upgradeUrl !== '/doyaslide/pricing'))) throw new Error(guidance)
      return data
    })()
    return await Promise.race([reading, stopped])
  } catch { throw new Error(guidance) }
  finally {
    if (timer) clearTimeout(timer)
    if (abort) signal.removeEventListener('abort', abort)
    void reader?.cancel().catch(() => {})
  }
}
