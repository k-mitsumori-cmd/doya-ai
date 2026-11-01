import { BillingResponseError } from '@/lib/billing-response-client'

export async function readAioStartResponse(path: string, init: RequestInit, signal: AbortSignal): Promise<{
  ok: boolean; status: number; data: Record<string, unknown>
}> {
  if (signal.aborted) throw new BillingResponseError(true)
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new BillingResponseError(true)) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new BillingResponseError()) }, init.method === 'POST' ? 310_000 : 35_000)
  })
  const work = (async () => {
    const response = await fetch(path, { ...init, cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted || !response.body || Number(response.headers.get('content-length')) > 64 * 1024) throw new BillingResponseError()
    reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new BillingResponseError()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 64 * 1024) throw new BillingResponseError()
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BillingResponseError()
    return { ok: response.ok, status: response.status, data: data as Record<string, unknown> }
  })()
  try {
    return await Promise.race([work, stop])
  } catch {
    throw new BillingResponseError(signal.aborted)
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
    if (reader) { try { void reader.cancel().catch(() => {}) } catch {} }
  }
}

