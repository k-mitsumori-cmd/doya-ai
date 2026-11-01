import { validAdImageLogoContext, type AdImageLogoContext } from './logo-context'
import { DEFAULT_LOGO_CONFIG, type LogoConfig, type LogoPosition } from './logo'

export class AdImageLogoError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
export const ADIMAGE_LOGO_MAX_BYTES = 3 * 1024 * 1024
const MAX_BODY = ADIMAGE_LOGO_MAX_BYTES + 256 * 1024
const POSITIONS: LogoPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center-top']

export function parseAdImageLogoForm(form: FormData): { file: File; config: LogoConfig; context?: AdImageLogoContext } {
  const keys = [...form.keys()]
  if (keys.some(key => !['file', 'pos', 'maxWidthPct', 'paddingPct', 'context'].includes(key)) || new Set(keys).size !== keys.length) throw new AdImageLogoError(400, 'ロゴの設定内容を確認してください。')
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) throw new AdImageLogoError(400, 'ロゴ画像を選択してください。')
  if (file.size > ADIMAGE_LOGO_MAX_BYTES) throw new AdImageLogoError(413, 'ロゴ画像は3MB以下にしてください。')
  const numeric = (key: string, fallback: number, min: number, max: number) => {
    const value = form.get(key)
    if (value === null || value === '') return fallback
    if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new AdImageLogoError(400, 'ロゴのサイズと余白を確認してください。')
    return Number(value)
  }
  const pos = form.get('pos')
  if (pos !== null && pos !== '' && (typeof pos !== 'string' || !POSITIONS.includes(pos as LogoPosition))) throw new AdImageLogoError(400, 'ロゴの位置を確認してください。')
  const context = parseLogoContext(form)
  return { file, ...(context ? { context } : {}), config: { pos: (pos || DEFAULT_LOGO_CONFIG.pos) as LogoPosition, maxWidthPct: numeric('maxWidthPct', DEFAULT_LOGO_CONFIG.maxWidthPct, 5, 50), paddingPct: numeric('paddingPct', DEFAULT_LOGO_CONFIG.paddingPct, 0, 15) } }
}

function parseLogoContext(form: FormData): AdImageLogoContext | undefined {
  const rawContext = form.get('context')
  let context: AdImageLogoContext | undefined
  if (rawContext !== null) {
    try {
      if (typeof rawContext !== 'string' || new TextEncoder().encode(rawContext).byteLength > 192 * 1024) throw new Error()
      const value: unknown = JSON.parse(rawContext)
      if (!validAdImageLogoContext(value)) throw new Error()
      context = value
    } catch { throw new AdImageLogoError(400, '編集中の内容を確認できません。入力内容を確認してください。') }
  }
  return context
}

/** Bound actual multipart bytes, elapsed read time, and duplicate fields before decoding an image. */
async function readLogoForm<T>(req: Request, parser: (form: FormData) => T, maxBytes = MAX_BODY) {
  const length = req.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new AdImageLogoError(400, '送信内容を確認してください。')
  if (Number(length) > maxBytes) throw new AdImageLogoError(413, 'ロゴ画像は3MB以下にしてください。')
  if (!/^multipart\/form-data\s*;/i.test(req.headers.get('content-type') || '') || !req.body) throw new AdImageLogoError(400, 'ロゴ画像を選択してください。')
  const reader = req.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new AdImageLogoError(408, '画像を受け取れませんでした。通信状態をご確認ください。'))
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
        if (size > maxBytes) throw new AdImageLogoError(413, 'ロゴ画像は3MB以下にしてください。')
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { return parser(await new Response(bytes, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData()) }
      catch (error) { if (error instanceof AdImageLogoError) throw error; throw new AdImageLogoError(400, '画像の送信内容を確認してください。') }
    })()
    return await Promise.race([reading, stopped])
  } finally {
    if (timer) clearTimeout(timer)
    if (abort) req.signal.removeEventListener('abort', abort)
    void reader.cancel().catch(() => {})
  }
}

export async function readAdImageLogoForm(req: Request) { return readLogoForm(req, parseAdImageLogoForm) }
export async function readAdImageLogoRemovalContext(req: Request) {
  if (!req.body) return undefined
  return readLogoForm(req, form => {
    if ([...form.keys()].some(key => key !== 'context') || form.getAll('context').length > 1) throw new AdImageLogoError(400, '送信内容を確認してください。')
    return parseLogoContext(form)
  }, 256 * 1024)
}
