import { UrlAnalysisError, validAnalysisUrl, type UrlAnalysisResult } from './url-analysis-client'
import type { UrlAnalysisIntent } from './url-analysis-intent-client'
export type UrlAnalysisSavedResult = { operationId: string; state: 'pending' | 'completed' | 'failed' | 'cancelled' | 'missing' | 'busy'; sourceUrl: string | null; result: UrlAnalysisResult | null; reserved: boolean; code: string | null }
/** POST admits a persisted UUID; GET/DELETE only recover or fence it. Never retries automatically. */
export async function fetchUrlAnalysisOperation(intent: UrlAnalysisIntent, method: 'POST' | 'GET' | 'DELETE', signal: AbortSignal, url?: string): Promise<UrlAnalysisSavedResult> {
  if (signal.aborted) throw new UrlAnalysisError('cancelled')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(intent.operationId) || (method === 'POST' && (!url || !validAnalysisUrl(url)))) throw new UrlAnalysisError('failure')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new UrlAnalysisError('cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new UrlAnalysisError('unknown')) }, method === 'POST' ? 310_000 : 30_000)
  })
  const work = (async () => {
    const endpoint = '/api/doyaslide/analyze' + (method === 'POST' ? '' : '?operationId=' + encodeURIComponent(intent.operationId))
    const response = await fetch(endpoint, { method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, operationId: intent.operationId }) } : {}), cache: 'no-store', signal: controller.signal })
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
    if (row.operationId !== intent.operationId || row.error !== undefined) throw new UrlAnalysisError('unknown')
    const valueRow = row as unknown as UrlAnalysisSavedResult
    if (!['pending','completed','failed','cancelled','missing','busy'].includes(valueRow.state) || typeof valueRow.reserved !== 'boolean') throw new UrlAnalysisError('unknown')
    const expectedStatus = valueRow.state === 'pending' ? 202 : valueRow.state === 'busy' ? 409
      : valueRow.state === 'failed' ? (valueRow.code === 'DOYASLIDE_TEXT_DAILY_LIMIT' ? 429 : 400) : 200
    if (response.status !== expectedStatus || ![null,'ANALYSIS_FAILED','OPERATION_EXPIRED','DOYASLIDE_TEXT_DAILY_LIMIT'].includes(valueRow.code)) throw new UrlAnalysisError('unknown')
    if (valueRow.sourceUrl !== null && (typeof valueRow.sourceUrl !== 'string' || !validAnalysisUrl(valueRow.sourceUrl))) throw new UrlAnalysisError('unknown')
    if (valueRow.state === 'completed') {
      const result = valueRow.result
      if (!valueRow.reserved || !valueRow.sourceUrl || valueRow.code !== null || !result || typeof result !== 'object' || Array.isArray(result)
        || typeof result.title !== 'string' || result.title.length > 120
        || typeof result.brief !== 'string' || result.brief.length > 2000
        || typeof result.referenceText !== 'string' || !result.referenceText.trim() || result.referenceText.length > 6000
        || typeof result.aiAnalyzed !== 'boolean'
        || Object.keys(result).some(key => !['title','brief','referenceText','aiAnalyzed'].includes(key))) throw new UrlAnalysisError('unknown')
    } else if (valueRow.result !== null) throw new UrlAnalysisError('unknown')
    if (valueRow.state === 'pending' && (!valueRow.sourceUrl || !valueRow.reserved || valueRow.code !== null)) throw new UrlAnalysisError('unknown')
    if (valueRow.state === 'failed' && (!valueRow.sourceUrl || valueRow.code === null || (valueRow.code === 'DOYASLIDE_TEXT_DAILY_LIMIT' ? valueRow.reserved : !valueRow.reserved))) throw new UrlAnalysisError('unknown')
    if (valueRow.state === 'cancelled' && (valueRow.code !== null || (!valueRow.sourceUrl && valueRow.reserved))) throw new UrlAnalysisError('unknown')
    if (['missing','busy'].includes(valueRow.state) && (valueRow.sourceUrl !== null || valueRow.reserved || valueRow.code !== null)) throw new UrlAnalysisError('unknown')
    if (Object.keys(row).some(key => !['operationId','state','sourceUrl','result','reserved','code'].includes(key))) throw new UrlAnalysisError('unknown')
    return valueRow
  })()
  try { return await Promise.race([work, stop]) }
  catch (error) { throw error instanceof UrlAnalysisError ? error : new UrlAnalysisError(signal.aborted ? 'cancelled' : 'unknown') }
  finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
