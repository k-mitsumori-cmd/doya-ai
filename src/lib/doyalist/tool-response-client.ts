export const DOYALIST_UNKNOWN_RESULT = '生成・保存結果を確認できませんでした。履歴を確認してから、再度お試しください。'

export { validDoyalistToolResult } from './tool-result'

/** A browser cancellation cannot establish whether the server consumed quota or saved a result. */
export async function readDoyalistToolResponse(init: RequestInit, signal: AbortSignal) {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectStop: (error: Error) => void = () => {}
  const stop = new Promise<never>((_, reject) => { rejectStop = reject })
  const cancel = () => {
    controller.abort()
    void reader?.cancel().catch(() => {})
    rejectStop(new Error(DOYALIST_UNKNOWN_RESULT))
  }
  signal.addEventListener('abort', cancel, { once: true })
  timer = setTimeout(cancel, 310000) // API route maxDuration is 300 seconds.
  try {
    if (signal.aborted) { cancel(); return await stop }
    return await Promise.race([stop, (async () => {
      const res = await fetch('/api/doyalist/tools', { ...init, signal: controller.signal })
      if (controller.signal.aborted || !res.body || Number(res.headers.get('content-length')) > 65536) {
        controller.abort(); void res.body?.cancel().catch(() => {}); throw new Error(DOYALIST_UNKNOWN_RESULT)
      }
      reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = '', bytes = 0
      while (true) {
        const chunk = await reader.read()
        if (controller.signal.aborted) throw new Error(DOYALIST_UNKNOWN_RESULT)
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 65536) { controller.abort(); throw new Error(DOYALIST_UNKNOWN_RESULT) }
        text += decoder.decode(chunk.value, { stream: true })
      }
      text += decoder.decode()
      const data: unknown = JSON.parse(text)
      return { res, data }
    })()])
  } catch { throw new Error(DOYALIST_UNKNOWN_RESULT) } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    void reader?.cancel().catch(() => {})
    try { reader?.releaseLock() } catch { /* A pending cancel settles separately. */ }
  }
}
