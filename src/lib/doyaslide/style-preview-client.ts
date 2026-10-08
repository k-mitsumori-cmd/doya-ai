export type StylePreviewReply = { urls: string[]; pending: boolean; capped: boolean }

function publicImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}

/** Preview generation can take 300 seconds. Bound both headers and streamed JSON, including stalled bodies. */
export async function readStylePreview(style: string, signal: AbortSignal, timeoutMs: number): Promise<StylePreviewReply> {
  if (signal.aborted || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Preview cancelled')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error('Preview cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('Preview deadline')) }, Math.min(310_000, timeoutMs))
  })
  const work = (async () => {
    const response = await fetch(`/api/doyaslide/style-preview?style=${encodeURIComponent(style)}`, { cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted || !response.body || Number(response.headers.get('content-length')) > 65_536) throw new Error('Preview response')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new Error('Preview cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 65_536) throw new Error('Preview response too large')
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Preview response')
    const row = data as Record<string, unknown>
    if (response.status === 429 && row.code === 'STYLE_PREVIEW_DAILY_CAP') return { urls: [], pending: false, capped: true }
    if (![200,202].includes(response.status) || row.error !== undefined || row.code !== undefined || typeof row.pending !== 'boolean'
      || !Array.isArray(row.urls) || row.urls.length > 3 || !row.urls.every(publicImageUrl)
      || (response.status === 202 && !row.pending) || (row.url !== undefined && row.url !== (row.urls[0] ?? null))) throw new Error('Preview response')
    return { urls: [...row.urls], pending: row.pending, capped: false }
  })()
  try { return await Promise.race([work, stop]) } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
