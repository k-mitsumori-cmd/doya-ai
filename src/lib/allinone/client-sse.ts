/**
 * SSE クライアントヘルパ（ブラウザ側）
 * fetch の ReadableStream を行単位で parse して callback 呼び出し。
 */

export async function consumeSse<T>(
  url: string,
  init: RequestInit,
  onEvent: (event: T) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, { ...init, signal })
  if (!res.ok || !res.body) {
    throw new Error(`SSE request failed: ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let lineEnd
    while ((lineEnd = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, lineEnd).trim()
      buffer = buffer.slice(lineEnd + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        onEvent(JSON.parse(payload))
      } catch {
        /* ignore malformed */
      }
    }
  }
}
