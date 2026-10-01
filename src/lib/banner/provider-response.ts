import { withTimeout } from '@/lib/fetch-timeout'

const RESPONSE_MAX_BYTES = 1024 * 1024
const ERROR_MAX_BYTES = 64 * 1024

async function readBody(response: Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    void response.body?.cancel().catch(() => {})
    throw new Error('Banner text provider response is too large')
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new Error('Banner text provider response is too large')
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, length).toString('utf8')
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** One deadline covers the provider connection and the complete response body. */
export async function requestBannerTextProvider(endpoint: string, body: unknown): Promise<{ status: number; ok: boolean; text: string }> {
  return withTimeout('banner-text-provider', 30_000, async signal => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    return {
      status: response.status,
      ok: response.ok,
      text: await readBody(response, response.ok ? RESPONSE_MAX_BYTES : ERROR_MAX_BYTES),
    }
  })
}
