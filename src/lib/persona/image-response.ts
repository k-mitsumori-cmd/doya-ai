// The server may still finish and save an image after a browser connection is interrupted.
export class PersonaImageResponseError extends Error {}
const UNKNOWN_RESULT = '画像の生成・保存結果を確認できませんでした。履歴を確認するか、同じ操作を再試行してください。'

export function validPersonaImageResponse(data: any): data is { success: true; image: string } {
  return data?.success === true && typeof data.image === 'string'
    && /^\/api\/persona\/images\/[a-zA-Z0-9_-]{1,128}$/.test(data.image)
}

export function personaImageError(cause: unknown, response?: Response | null): string {
  if (cause instanceof PersonaImageResponseError) return cause.message
  if (response?.status === 401) return '再度ログインしてから画像を生成してください。'
  if (response?.status === 404) return '対象のペルソナが見つかりません。履歴から開き直してください。'
  if (response?.status === 409) return '画像を処理中、または保存状態が変わりました。履歴を確認してから再度お試しください。'
  if (response?.status === 429) return 'リクエスト回数の上限に達しました。時間を置いて再度お試しください。'
  return UNKNOWN_RESULT
}

export async function readPersonaImageResponse(url: string, init: RequestInit) {
  const controller = new AbortController()
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectDeadline: (reason: unknown) => void = () => {}
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject })
  const abort = () => { controller.abort(); void activeReader?.cancel().catch(() => {}); rejectDeadline(new PersonaImageResponseError(UNKNOWN_RESULT)) }
  init.signal?.addEventListener('abort', abort, { once: true })
  timer = setTimeout(abort, 310000)
  try {
    if (init.signal?.aborted) { abort(); return await deadline }
    return await Promise.race([deadline, (async () => {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (controller.signal.aborted) { void res.body?.cancel().catch(() => {}); throw new PersonaImageResponseError(UNKNOWN_RESULT) }
      const maxBytes = 65536
      const contentLength = res.headers?.get('content-length')
      if (contentLength && Number(contentLength) > maxBytes) { controller.abort(); void res.body?.cancel().catch(() => {}); throw new PersonaImageResponseError(UNKNOWN_RESULT) }
      let text = ''
      if (res.body) {
        const reader = res.body.getReader(), decoder = new TextDecoder()
        activeReader = reader
        let bytes = 0
        try {
          for (;;) {
            const chunk = await reader.read()
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > maxBytes) { controller.abort(); throw new PersonaImageResponseError(UNKNOWN_RESULT) }
            text += decoder.decode(chunk.value, { stream: true })
          }
          text += decoder.decode()
        } finally {
          void reader.cancel().catch(() => {})
          try { reader.releaseLock() } catch { /* A pending cancellation releases it when the read settles. */ }
          activeReader = null
        }
      } else {
        text = await res.text()
        if (new TextEncoder().encode(text).byteLength > maxBytes) throw new PersonaImageResponseError(UNKNOWN_RESULT)
      }
      let data: any = null
      try { data = text ? JSON.parse(text) : null } catch { /* The caller must not accept unreadable success responses. */ }
      return { res, data }
    })()])
  } catch (cause) {
    if (cause instanceof PersonaImageResponseError) throw cause
    throw new PersonaImageResponseError(UNKNOWN_RESULT)
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', abort)
  }
}
