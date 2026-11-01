/** Metadata only: image and prompt contents are never written to browser storage. */
export type BannerTextIntent = { version: 1; operationId: string; createdAt: string }
export type BannerTextResult = { state: string; operationId?: string; reply?: string; spec?: { purpose: string; category: string; size: string; keyword: string; imageDescription?: string; brandColors?: string[] } | null; suggestions?: string[]; code?: string; error?: string; usage?: { dailyUsed: number; dailyLimit: number; dailyRemaining: number }; upgradeUrl?: string; contactUrl?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const storageKey = (actor: string) => 'banner-text-intent:v1:' + encodeURIComponent(actor)
const guidance = 'AI返信結果を確認できません。再生成せず「AI返信結果を確認」を押してください。'
export function readBannerTextIntent(actor: string): BannerTextIntent | null {
  if (!actor) return null
  const raw = localStorage.getItem(storageKey(actor))
  if (raw === null) return null
  let value: BannerTextIntent
  try { value = JSON.parse(raw) } catch { throw new Error('保存された操作情報を確認できません。お問い合わせください。') }
  if (!value || value.version !== 1 || !UUID.test(value.operationId) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || Object.keys(value).some(key => !['version', 'operationId', 'createdAt'].includes(key))) throw new Error('保存された操作情報を確認できません。お問い合わせください。')
  return value
}
export function createBannerTextIntent(actor: string): BannerTextIntent {
  if (!actor) throw new Error('ログインが必要です。')
  if (readBannerTextIntent(actor)) throw new Error('前のAI返信結果を確認してから、新しいAI返信を始めてください。')
  const value: BannerTextIntent = { version: 1, operationId: crypto.randomUUID(), createdAt: new Date().toISOString() }
  localStorage.setItem(storageKey(actor), JSON.stringify(value))
  if (readBannerTextIntent(actor)?.operationId !== value.operationId) throw new Error('操作情報を保存できません。新しいAI返信は開始していません。')
  return value
}
export function clearBannerTextIntent(actor: string, operationId: string) {
  if (readBannerTextIntent(actor)?.operationId === operationId) localStorage.removeItem(storageKey(actor))
}

/** Bound even a streaming/chunked response. Cancellation/deadline also covers image decoding. */
export async function readBannerTextResponse(response: Response, operationId: string, signal: AbortSignal): Promise<BannerTextResult> {
  const maximum = 70 * 1024
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
      const data: BannerTextResult & { success?: boolean } = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(guidance)
      // These rejections happen before admission; they do not carry operation IDs.
      if (response.status === 429 && data.code === 'DAILY_TEXT_LIMIT_REACHED') {
        const usage = data.usage
        if (!usage || ![usage.dailyUsed, usage.dailyLimit, usage.dailyRemaining].every(Number.isSafeInteger) || usage.dailyLimit < 0 || usage.dailyUsed < 0 || usage.dailyRemaining !== Math.max(0, usage.dailyLimit - usage.dailyUsed)) throw new Error(guidance)
        return { ...data, state: 'limit' }
      }
      if (data.operationId !== operationId) throw new Error(guidance)
      if (!['completed', 'pending', 'missing', 'failed', 'cancelled'].includes(data.state)) throw new Error(guidance)
      if (data.state === 'completed') {
        if (response.status !== 200) throw new Error(guidance)
        if (data.reply !== undefined && (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 4000)) throw new Error(guidance)
        if (data.suggestions !== undefined && (!Array.isArray(data.suggestions) || data.suggestions.length > 12 || !data.suggestions.every(value => typeof value === 'string' && value.trim() && value.length <= 2000))) throw new Error(guidance)
        if (!data.reply && !data.suggestions?.length) throw new Error(guidance)
        if (data.spec != null && (typeof data.spec !== 'object' || Array.isArray(data.spec) || !['purpose', 'category', 'size', 'keyword'].every(key => typeof (data.spec as unknown as Record<string, unknown>)[key] === 'string' && String((data.spec as unknown as Record<string, unknown>)[key]).trim()) || (data.spec.imageDescription != null && typeof data.spec.imageDescription !== 'string') || (data.spec.brandColors != null && (!Array.isArray(data.spec.brandColors) || !data.spec.brandColors.every(color => typeof color === 'string'))))) throw new Error(guidance)
      } else if (({pending: 202, missing: 404, failed: 409, cancelled: 409} as Record<string, number>)[data.state] !== response.status && !(data.state === 'failed' && [500, 502].includes(response.status))) throw new Error(guidance)
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
