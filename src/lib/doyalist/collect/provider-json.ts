export type CollectionJsonResult = { ok: boolean; status: number; data: any }

/** Bound trusted provider responses as well as the connection and body deadline. */
export async function fetchCollectionJson(
  url: string,
  init: RequestInit,
  limits: { timeoutMs: number; maxBytes: number },
): Promise<CollectionJsonResult> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(limits.timeoutMs) })
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    return { ok: false, status: response.status, data: null }
  }
  if (Number(response.headers.get('content-length')) > limits.maxBytes) {
    void response.body?.cancel().catch(() => {})
    throw new Error('Collection provider response is too large')
  }
  if (!response.body) throw new Error('Collection provider response is empty')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limits.maxBytes) throw new Error('Collection provider response is too large')
      chunks.push(Buffer.from(value))
    }
    return { ok: true, status: response.status, data: JSON.parse(Buffer.concat(chunks, length).toString('utf8')) }
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
