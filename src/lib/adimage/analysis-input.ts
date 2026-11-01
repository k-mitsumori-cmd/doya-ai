export class AdImageAnalysisInputError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export interface AdImageAnalysisBody {
  operationId: string
  url: string
  manualText?: string
  appeal?: string
  objective?: string
}

/** Analysis-specific boundary. No quota, source fetch or model call is made here. */
export async function readAdImageAnalysisBody(req: Request): Promise<AdImageAnalysisBody> {
  const invalid = () => new AdImageAnalysisInputError(400, '入力内容を確認してください。')
  const large = () => new AdImageAnalysisInputError(413, '入力が長すぎます。')
  const timeout = () => new AdImageAnalysisInputError(408, '入力を受け取れませんでした。通信状態をご確認ください。')
  const declared = req.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) throw invalid()
  if (Number(declared) > 64 * 1024) throw large()
  if (!req.body) throw invalid()
  const reader = req.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(timeout())
      timer = setTimeout(abort, 15000)
      req.signal.addEventListener('abort', abort, { once: true })
      if (req.signal.aborted) abort()
    })
    const reading = (async () => {
      const chunks: Uint8Array[] = []; let size = 0
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 64 * 1024) throw large()
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown } catch { throw invalid() }
    })()
    const value = await Promise.race([reading, stopped])
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
    const body = value as Record<string, unknown>
    if (Object.keys(body).some(k => !['operationId', 'url', 'manualText', 'appeal', 'objective'].includes(k))) throw invalid()
    // Never silently accept an old client request without durable operation identity.
    if (body.operationId === undefined) throw new AdImageAnalysisInputError(409, '画面を更新してから解析を開始してください。')
    if (typeof body.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.operationId)) throw invalid()
    if (typeof body.url !== 'string' || Buffer.byteLength(body.url, 'utf8') > 8192 || !body.url.trim()) throw invalid()
    const rawUrl = body.url.trim()
    let url: URL
    try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`) } catch { throw invalid() }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw invalid()
    if (body.manualText !== undefined && (typeof body.manualText !== 'string' || body.manualText.trim().length < 50 || body.manualText.trim().length > 14000)) throw invalid()
    // Reject overlong instructions rather than changing what the user asked for.
    if (body.appeal !== undefined && (typeof body.appeal !== 'string' || body.appeal.length > 500)) throw invalid()
    if (body.objective !== undefined && (typeof body.objective !== 'string' || body.objective.length > 100)) throw invalid()
    return {
      operationId: body.operationId.toLowerCase(), url: url.toString(),
      ...(body.manualText !== undefined ? { manualText: (body.manualText as string).trim() } : {}),
      ...(body.appeal !== undefined ? { appeal: body.appeal as string } : {}),
      ...(body.objective !== undefined ? { objective: body.objective as string } : {}),
    }
  } finally {
    if (timer) clearTimeout(timer)
    if (abort) req.signal.removeEventListener('abort', abort)
    void reader.cancel().catch(() => {})
  }
}
