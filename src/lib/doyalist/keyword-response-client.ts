export const KEYWORD_UNKNOWN_RESULT = '変換結果を確認できませんでした。時間をおいて再度お試しください。'

export function parseKeywordTags(value: unknown): string[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.success !== true || data.error !== undefined || data.code !== undefined ||
      !Array.isArray(data.tags) || data.tags.length < 1 || data.tags.length > 8 ||
      data.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 20)) return null
  return Array.from(new Set((data.tags as string[]).map(tag => tag.trim())))
}

/** The endpoint permits 60 seconds; include body reading in the 65-second browser deadline. */
export async function readKeywordResponse(init: RequestInit, signal: AbortSignal) {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let rejectStop: (error: Error) => void = () => {}
  const stop = new Promise<never>((_, reject) => { rejectStop = reject })
  const cancel = () => { controller.abort(); void reader?.cancel().catch(() => {}); rejectStop(new Error(KEYWORD_UNKNOWN_RESULT)) }
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, 65000)
  try {
    if (signal.aborted) { cancel(); return await stop }
    return await Promise.race([stop, (async () => {
      const res = await fetch('/api/doyalist/expand-keywords', { ...init, cache: 'no-store', signal: controller.signal })
      if (controller.signal.aborted || !res.body || Number(res.headers.get('content-length')) > 65536) throw new Error(KEYWORD_UNKNOWN_RESULT)
      reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let text = '', bytes = 0
      while (true) {
        const chunk = await reader.read()
        if (controller.signal.aborted) throw new Error(KEYWORD_UNKNOWN_RESULT)
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 65536) throw new Error(KEYWORD_UNKNOWN_RESULT)
        text += decoder.decode(chunk.value, { stream: true })
      }
      const data: unknown = JSON.parse(text + decoder.decode())
      return { ok: res.ok, data }
    })()])
  } catch { throw new Error(KEYWORD_UNKNOWN_RESULT) } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    void reader?.cancel().catch(() => {})
    try { reader?.releaseLock() } catch { /* Pending cancellation settles separately. */ }
  }
}
