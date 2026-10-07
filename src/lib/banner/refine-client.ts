/** Metadata only: image and prompt contents are never written to browser storage. */
export type BannerRefineIntent = { version: 1; operationId: string; createdAt: string }
export type BannerRefineResult = { state: string; operationId?: string; generationId?: string; refinedImage?: string; code?: string; error?: string; usage?: { monthlyUsed: number; monthlyLimit: number; monthlyRemaining: number }; upgradeUrl?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const storageKey = (actor: string) => 'banner-refine-intent:v1:' + encodeURIComponent(actor)
const guidance = '修正結果を確認できません。再生成せず「修正結果を確認」を押してください。'
export function readBannerRefineIntent(actor: string): BannerRefineIntent | null {
  if (!actor) return null
  const raw = localStorage.getItem(storageKey(actor))
  if (raw === null) return null
  let value: BannerRefineIntent
  try { value = JSON.parse(raw) } catch { throw new Error('保存された操作情報を確認できません。お問い合わせください。') }
  if (!value || value.version !== 1 || !UUID.test(value.operationId) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || Object.keys(value).some(key => !['version', 'operationId', 'createdAt'].includes(key))) throw new Error('保存された操作情報を確認できません。お問い合わせください。')
  return value
}
export function createBannerRefineIntent(actor: string): BannerRefineIntent {
  if (!actor) throw new Error('ログインが必要です。')
  if (readBannerRefineIntent(actor)) throw new Error('前の修正結果を確認してから、新しい修正を始めてください。')
  const value: BannerRefineIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString() }
  localStorage.setItem(storageKey(actor), JSON.stringify(value))
  if (readBannerRefineIntent(actor)?.operationId !== value.operationId) throw new Error('操作情報を保存できません。新しい修正は開始していません。')
  return value
}
export function clearBannerRefineIntent(actor: string, operationId: string) {
  if (readBannerRefineIntent(actor)?.operationId === operationId) localStorage.removeItem(storageKey(actor))
}

/** Bound even a streaming/chunked response. Cancellation/deadline also covers image decoding. */
export async function readBannerRefineResponse(response: Response, operationId: string, signal: AbortSignal): Promise<BannerRefineResult> {
  const maximum = 33 * 1024 * 1024
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new Error(guidance))
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      timer = setTimeout(abort, 30000)
    })
    const reading = (async () => {
      if (Number(response.headers.get('content-length')) > maximum || !response.body) throw new Error(guidance)
      reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let length = 0
      while (true) {
        const next = await reader.read()
        if (next.done) break
        length += next.value.byteLength
        if (length > maximum) throw new Error(guidance)
        chunks.push(next.value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const data: BannerRefineResult & { success?: boolean } = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(guidance)
      // These rejections happen before admission; they do not carry operation IDs.
      if (response.status === 429 && data.code === 'MONTHLY_LIMIT_REACHED') {
        const usage = data.usage
        if (!usage || ![usage.monthlyUsed, usage.monthlyLimit, usage.monthlyRemaining].every(Number.isSafeInteger) || usage.monthlyLimit < 0 || usage.monthlyUsed < 0 || usage.monthlyRemaining !== Math.max(0, usage.monthlyLimit - usage.monthlyUsed)) throw new Error(guidance)
        return { ...data, state: 'limit' }
      }
      if (data.operationId !== operationId) throw new Error(guidance)
      if (!['completed', 'pending', 'missing', 'failed', 'cancelled', 'unavailable'].includes(data.state)) throw new Error(guidance)
      if (data.state === 'completed') {
        if (!response.ok || data.success !== true || typeof data.generationId !== 'string' || !/^banner-refine-[a-f0-9]{64}$/.test(data.generationId) || typeof data.refinedImage !== 'string' || data.refinedImage.length > 32 * 1024 * 1024 || (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.refinedImage) || data.refinedImage.split(',')[1].length % 4 !== 0)) throw new Error(guidance)
        await decodeImage(data.refinedImage, signal)
      } else if (data.success === true || (data.state === 'unavailable' ? response.status !== 410 : ![200, 202, 409, 503].includes(response.status))) throw new Error(guidance)
      return data
    })()
    return await Promise.race([reading, stopped])
  } catch { throw new Error(guidance) }
  finally {
    if (timer) clearTimeout(timer)
    if (abort) signal.removeEventListener('abort', abort)
    void reader?.cancel().catch(() => {})
  }
}
async function decodeImage(source: string, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    let timer: ReturnType<typeof setTimeout> | undefined
    const clean = () => { if (timer) clearTimeout(timer); signal.removeEventListener('abort', failed); image.onload = null; image.onerror = null; image.src = '' }
    const failed = () => { clean(); reject(new Error(guidance)) }
    image.onload = () => {
      const valid = image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth <= 8192 && image.naturalHeight <= 8192 && image.naturalWidth * image.naturalHeight <= 16 * 1024 * 1024
      clean()
      if (valid) resolve(); else reject(new Error(guidance))
    }
    image.onerror = failed
    signal.addEventListener('abort', failed, { once: true })
    timer = setTimeout(failed, 15000)
    if (signal.aborted) failed(); else image.src = source
  })
}
