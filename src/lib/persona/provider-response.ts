const PERSONA_RESPONSE_MAX_BYTES = 2 * 1024 * 1024

/** Bound the provider envelope before JSON parsing or result-schema validation. */
export async function readPersonaProviderJson(response: Response): Promise<any> {
  if (Number(response.headers.get('content-length')) > PERSONA_RESPONSE_MAX_BYTES) {
    void response.body?.cancel().catch(() => {})
    throw new Error('Persona provider response is too large')
  }
  if (!response.body) throw new Error('Persona provider response is empty')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > PERSONA_RESPONSE_MAX_BYTES) throw new Error('Persona provider response is too large')
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
