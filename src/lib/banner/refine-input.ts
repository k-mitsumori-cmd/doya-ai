import sharp from 'sharp'
import { BannerOperationError, bannerRefineOperationId } from './refine-operation'

const BODY_BYTES = 4 * 1024 * 1024
const PIXELS = 16 * 1024 * 1024
export type BannerRefineInput = { originalImage: string; instruction: string; category?: string; size?: string; operationId?: string }

function imageSize(value: unknown): [number, number] {
  if (typeof value !== 'string' || !/^\d{2,4}x\d{2,4}$/.test(value)) throw new BannerOperationError(400, '画像サイズを確認してください。')
  const [w, h] = value.split('x').map(Number)
  if (w < 50 || h < 50 || w > 4096 || h > 4096 || w * h > PIXELS) throw new BannerOperationError(400, '画像サイズを確認してください。')
  return [w, h]
}

async function bodyText(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > BODY_BYTES) {
    void request.body?.cancel().catch(() => {})
    throw new BannerOperationError(413, '画像データが大きすぎます。画像を小さくしてください。')
  }
  if (!request.body) throw new BannerOperationError(400, '入力内容を確認してください。')
  const reader = request.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      const fail = () => reject(new BannerOperationError(408, '入力を受け取れませんでした。通信状態をご確認ください。'))
      timer = setTimeout(fail, 15000)
      abort = fail
      request.signal.addEventListener('abort', fail, { once: true })
      if (request.signal.aborted) fail()
    })
    const reading = (async () => {
      const chunks: Buffer[] = []
      let bytes = 0
      while (true) {
        const next = await reader.read()
        if (next.done) break
        bytes += next.value.byteLength
        if (bytes > BODY_BYTES) throw new BannerOperationError(413, '画像データが大きすぎます。画像を小さくしてください。')
        chunks.push(Buffer.from(next.value))
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes))
    })()
    return await Promise.race([reading, stopped])
  } finally {
    if (timer) clearTimeout(timer)
    if (abort) request.signal.removeEventListener('abort', abort)
    void reader.cancel().catch(() => {})
  }
}

export async function readBannerRefineInput(request: Request): Promise<BannerRefineInput> {
  let value: unknown
  try { value = JSON.parse(await bodyText(request)) }
  catch (error) {
    if (error instanceof BannerOperationError) throw error
    throw new BannerOperationError(400, '入力形式が正しくありません。')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BannerOperationError(400, '入力内容を確認してください。')
  const body = value as Record<string, unknown>
  if (Object.keys(body).some(key => !['originalImage', 'instruction', 'category', 'size', 'operationId'].includes(key))) throw new BannerOperationError(400, '入力項目が正しくありません。')
  if (typeof body.instruction !== 'string' || body.instruction.trim().length < 3 || body.instruction.length > 2000) throw new BannerOperationError(400, '修正指示は3〜2,000文字で入力してください。')
  if (typeof body.originalImage !== 'string' || !body.originalImage) throw new BannerOperationError(400, '元画像が見つかりません。生成結果から選択してください。')
  if (body.category !== undefined && (typeof body.category !== 'string' || !body.category.trim() || body.category.length > 80)) throw new BannerOperationError(400, '画像の業種を確認してください。')
  if (body.size !== undefined) imageSize(body.size)
  return { originalImage: body.originalImage, instruction: body.instruction.trim(), ...(body.category !== undefined ? { category: (body.category as string).trim() } : {}), ...(body.size !== undefined ? { size: body.size as string } : {}), ...(body.operationId !== undefined ? { operationId: bannerRefineOperationId(body.operationId) } : {}) }
}

async function raster(dataUrl: string, maxBytes: number) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match || match[2].length % 4 !== 0 || match[2].length > Math.ceil(maxBytes / 3) * 4) throw new BannerOperationError(400, '画像形式を確認してください。PNG・JPEG・WebP・GIFをご利用ください。')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > maxBytes || buffer.toString('base64') !== match[2]) throw new BannerOperationError(400, '画像データを確認してください。')
  try {
    const metadata = await sharp(buffer, { limitInputPixels: PIXELS }).metadata()
    const formats: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
    if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192 || metadata.width * metadata.height > PIXELS || formats[metadata.format || ''] !== match[1]) throw new Error('Invalid raster')
    return buffer
  } catch { throw new BannerOperationError(400, '画像を読み取れませんでした。別の画像をご利用ください。') }
}

export async function compressBannerRefineInput(dataUrl: string): Promise<string> {
  try {
    const buffer = await raster(dataUrl, BODY_BYTES)
    const output = await sharp(buffer, { limitInputPixels: PIXELS }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
    return 'data:image/png;base64,' + output.toString('base64')
  } catch (error) {
    if (error instanceof BannerOperationError) throw error
    throw new BannerOperationError(400, '画像を読み取れませんでした。別の画像をご利用ください。')
  }
}

export async function normalizeBannerRefineOutput(dataUrl: string, size?: string): Promise<string> {
  const buffer = await raster(dataUrl, 24 * 1024 * 1024)
  const image = sharp(buffer, { limitInputPixels: PIXELS }).rotate()
  if (size !== undefined) {
    const [w, h] = imageSize(size)
    image.resize(w, h, { fit: 'cover', position: 'centre' })
  }
  const output = await image.png({ compressionLevel: 9 }).toBuffer()
  const encoded = 'data:image/png;base64,' + output.toString('base64')
  if (encoded.length > 32 * 1024 * 1024) throw new BannerOperationError(503, '修正画像が大きすぎます。')
  return encoded
}
