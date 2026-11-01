import { REFINE_CHIPS } from './feedback'

export class AdImageFeedbackInputError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export interface AdImageFeedbackBody {
  creativeId?: string
  operationId?: string
  chips: string[]
  note: string
}

/** モデル呼び出し前に、容量・読み取り時間・型を制限する。 */
export async function readAdImageFeedbackBody(req: Request): Promise<AdImageFeedbackBody> {
  const invalid = () => new AdImageFeedbackInputError(400, '入力内容を確認してください。')
  const tooLarge = () => new AdImageFeedbackInputError(413, '入力が長すぎます。')
  const declared = req.headers.get('content-length')
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) throw invalid()
  if (Number(declared) > 8192) throw tooLarge()
  if (!req.body) throw invalid()
  const reader = req.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = () => new AdImageFeedbackInputError(408, '入力を受け取れませんでした。通信状態をご確認ください。')
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
        const next = await reader.read()
        if (next.done) break
        size += next.value.byteLength
        if (size > 8192) throw tooLarge()
        chunks.push(next.value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown } catch { throw invalid() }
    })()
    const body = await Promise.race([reading, stopped])
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid()
    const value = body as Record<string, unknown>
    if (Object.keys(value).some(key => !['operationId', 'creativeId', 'chips', 'note'].includes(key))) throw invalid()
    if (value.creativeId !== undefined && (typeof value.creativeId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value.creativeId))) throw invalid()
    if (value.operationId !== undefined && (typeof value.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.operationId))) throw invalid()
    if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length > 500)) throw invalid()
    const chips = value.chips === undefined ? [] : value.chips
    if (!Array.isArray(chips) || chips.length > REFINE_CHIPS.length || chips.some(chip => typeof chip !== 'string' || !REFINE_CHIPS.some(known => known.key === chip)) || new Set(chips).size !== chips.length) throw invalid()
    return { operationId: value.operationId as string | undefined, creativeId: value.creativeId as string | undefined, chips, note: (value.note as string | undefined)?.trim() ?? '' }
  } finally {
    if (timer) clearTimeout(timer)
    if (abort) req.signal.removeEventListener('abort', abort)
    void reader.cancel().catch(() => {})
  }
}
