const MAX_VISION_RESPONSE_BYTES = 1024 * 1024

export async function readBannerVisionJson(response: Response): Promise<any> {
  if (Number(response.headers.get('content-length')) > MAX_VISION_RESPONSE_BYTES) {
    void response.body?.cancel().catch(() => {})
    throw new Error('Banner Vision response is too large')
  }
  if (!response.body) throw new Error('Banner Vision response is empty')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_VISION_RESPONSE_BYTES) throw new Error('Banner Vision response is too large')
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
