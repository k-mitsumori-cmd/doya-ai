export type UrlAnalysisResult = { title: string; brief: string; referenceText: string; aiAnalyzed: boolean }
export class UrlAnalysisError extends Error {
  constructor(readonly kind: 'login' | 'limit' | 'failure' | 'unknown' | 'cancelled') { super(kind) }
}
export function validAnalysisUrl(value: string): boolean {
  if (!value || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password } catch { return false }
}
/** One attempt only. Client cancellation cannot establish that server analysis or budget reservation was cancelled. */
export async function readUrlAnalysis(url: string, signal: AbortSignal): Promise<UrlAnalysisResult> {
  if (signal.aborted) throw new UrlAnalysisError('cancelled')
  if (!validAnalysisUrl(url)) throw new UrlAnalysisError('failure')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new UrlAnalysisError('cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new UrlAnalysisError('unknown')) }, 310_000)
  })
  const work = (async () => {
    const response = await fetch('/api/doyaslide/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted || !response.body || Number(response.headers.get('content-length')) > 65_536) throw new UrlAnalysisError('unknown')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new UrlAnalysisError('cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 65_536) throw new UrlAnalysisError('unknown')
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UrlAnalysisError('unknown')
    const row = value as Record<string, unknown>
    if (response.status === 401) throw new UrlAnalysisError('login')
    if (response.status === 429 && row.code === 'DOYASLIDE_TEXT_DAILY_LIMIT') throw new UrlAnalysisError('limit')
    if (response.status === 400) throw new UrlAnalysisError('failure')
    if (response.status !== 200 || row.error !== undefined || row.code !== undefined
      || typeof row.title !== 'string' || row.title.length > 120
      || typeof row.brief !== 'string' || row.brief.length > 2000
      || typeof row.referenceText !== 'string' || !row.referenceText.trim() || row.referenceText.length > 6000
      || typeof row.aiAnalyzed !== 'boolean') throw new UrlAnalysisError('unknown')
    return { title: row.title, brief: row.brief, referenceText: row.referenceText, aiAnalyzed: row.aiAnalyzed }
  })()
  try { return await Promise.race([work, stop]) }
  catch (error) { throw error instanceof UrlAnalysisError ? error : new UrlAnalysisError(signal.aborted ? 'cancelled' : 'unknown') }
  finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
