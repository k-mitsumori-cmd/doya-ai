/** Read-only quota lookup: bound both the request and streamed body. */
export async function readBannerQuotaResponse(signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw new Error('Quota request cancelled')
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error('Quota request cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('Quota request timed out')) }, 10_000)
  })
  const work = (async () => {
    const response = await fetch('/api/usage/banner', { cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted || !response.ok || !response.body || Number(response.headers.get('content-length')) > 64 * 1024) throw new Error('Quota response unavailable')
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new Error('Quota request cancelled')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 64 * 1024) throw new Error('Quota response too large')
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  })()
  try { return await Promise.race([work, stop]) } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}
