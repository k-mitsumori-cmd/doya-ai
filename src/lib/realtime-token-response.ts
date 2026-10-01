export const REALTIME_REQUEST_TIMEOUT_MS = 15_000

const REALTIME_RESPONSE_MAX_BYTES = 256 * 1024

/** Read only the bounded provider JSON; error bodies and session credentials are never logged. */
export async function readRealtimeJson(response: Response): Promise<any> {
  if (Number(response.headers.get('content-length')) > REALTIME_RESPONSE_MAX_BYTES) {
    void response.body?.cancel().catch(() => {})
    throw new Error('Realtime response is too large')
  }
  if (!response.body) throw new Error('Realtime response is empty')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > REALTIME_RESPONSE_MAX_BYTES) throw new Error('Realtime response is too large')
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function realtimeClientSecret(data: any): string | null {
  const candidate = data?.value ?? data?.client_secret?.value
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}
