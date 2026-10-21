const MAX_RESPONSE_BYTES = 128 * 1024
// Server maxDuration=120秒。転送と端末の遅延を見込んで150秒で打ち切る。
const RESPONSE_DEADLINE_MS = 150_000

/** Timeout/abortはサーバーでの作成取消を意味しない。callerはoutcome_unknownとして扱う。 */
export async function readGenerationEnvelope(input: RequestInit, signal: AbortSignal): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (signal.aborted) throw new Error('Generation response cancelled')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error('Generation response cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('Generation response timed out')) }, RESPONSE_DEADLINE_MS)
  })
  const work = (async () => {
    const response = await fetch('/api/tenjikai/generate', { ...input, cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted || !response.body || Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('Invalid generation response')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new Error('Generation response cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new Error('Generation response too large')
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return { ok: response.ok, status: response.status, body: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
  })()
  try { return await Promise.race([work, stop]) } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
