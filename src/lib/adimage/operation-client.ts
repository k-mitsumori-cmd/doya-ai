import type { AdCopy, RefineDirective, FeedbackScores } from './types'
export type AdImageIntent = { version: 1; operationId: string; kind: 'generate' | 'refine' | 'feedback'; targetId: string; createdAt: string }
export type AdImageCreative = { id: string; placementKey: string; placementName: string; media: string; size: string; url: string; verify: { ocrMatch?: boolean; needsReview?: boolean; extraText?: string[]; safeAreaOk?: boolean } | null }
export type AdImageResult = { operationId: string; kind: AdImageIntent['kind']; targetId: string; state: 'completed' | 'pending' | 'busy' | 'missing' | 'failed' | 'cancelled' | 'unavailable' | 'limit'; conceptId?: string; campaignId?: string; copy?: AdCopy; generation?: number; creatives?: AdImageCreative[]; previousCreatives?: AdImageCreative[]; previousGeneration?: number | null; appliedDirectives?: RefineDirective[]; failedPlacements?: string[]; needsReview?: boolean; error?: string; code?: string; upgradeUrl?: string; contactUrl?: string; limitReached?: boolean; feedbackId?: string; creativeId?: string; scores?: FeedbackScores; advice?: string; directives?: RefineDirective[] }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const key = (actor: string) => 'adimage-intent:v1:' + encodeURIComponent(actor)
const guidance = '処理結果を確認できません。再生成せず「保存結果を確認」を押してください。'
function validIntent(v: AdImageIntent) { return v && v.version === 1 && typeof v.operationId === 'string' && uuid.test(v.operationId) && ['generate', 'refine', 'feedback'].includes(v.kind) && identifier(v.targetId) && typeof v.createdAt === 'string' && Number.isFinite(Date.parse(v.createdAt)) && Object.keys(v).every(k => ['version', 'operationId', 'kind', 'targetId', 'createdAt'].includes(k)) }
export function readAdImageIntent(actor: string): AdImageIntent | null {
  if (!identifier(actor)) throw new Error('ログイン情報を確認してください。')
  const raw = localStorage.getItem(key(actor)); if (raw === null) return null
  try { if (raw.length > 2048) throw new Error(); const value = JSON.parse(raw); if (!validIntent(value)) throw new Error(); return value }
  catch { throw new Error('保存された操作情報を確認できません。新しい生成はせずお問い合わせください。') }
}
export function createAdImageIntent(actor: string, kind: AdImageIntent['kind'], targetId: string): AdImageIntent {
  if (readAdImageIntent(actor)) throw new Error('前の操作の保存結果を確認してください。')
  const value: AdImageIntent = { version: 1, operationId: crypto.randomUUID(), kind, targetId, createdAt: new Date().toISOString() }
  if (!validIntent(value)) throw new Error('操作内容を確認してください。')
  localStorage.setItem(key(actor), JSON.stringify(value))
  if (readAdImageIntent(actor)?.operationId !== value.operationId) throw new Error('操作情報を保存できず、生成を開始していません。')
  return value
}
export function clearAdImageIntent(actor: string, operationId: string) {
  if (readAdImageIntent(actor)?.operationId !== operationId) throw new Error('保存された操作が変わりました。結果を再確認してください。')
  localStorage.removeItem(key(actor)); if (readAdImageIntent(actor) !== null) throw new Error('操作情報を更新できません。')
}
function validUrl(v: unknown): v is string { if (typeof v !== 'string' || v.length > 8192) return false; try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password } catch { return false } }
export async function fetchAdImageOperation(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  if (signal.aborted) throw new Error(guidance)
  let abort: (() => void) | undefined
  try { const stopped = new Promise<never>((_, reject) => { abort = () => reject(new Error(guidance)); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort() }); return await Promise.race([fetch(url, { ...init, signal }), stopped]) }
  finally { if (abort) signal.removeEventListener('abort', abort) }
}
export async function readAdImageOperationResponse(response: Response, intent: AdImageIntent, signal: AbortSignal): Promise<AdImageResult> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, timer: ReturnType<typeof setTimeout> | undefined, abort: (() => void) | undefined
  try {
    const stopped = new Promise<never>((_, reject) => { abort = () => reject(new Error(guidance)); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); timer = setTimeout(abort, 30000) })
    const reading = (async () => {
      if (!response.body || Number(response.headers.get('content-length')) > 256 * 1024) throw new Error(guidance)
      reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 256 * 1024) throw new Error(guidance); chunks.push(part.value) }
      const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength }
      const d: AdImageResult = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      if (!d || typeof d !== 'object' || Array.isArray(d) || d.operationId !== intent.operationId || d.kind !== intent.kind || d.targetId !== intent.targetId || !['completed', 'pending', 'busy', 'missing', 'failed', 'cancelled', 'unavailable', 'limit'].includes(d.state)) throw new Error(guidance)
      const expected = d.state === 'limit' ? 429 : ['pending', 'busy'].includes(d.state) ? 202 : 200
      if (response.status !== expected) throw new Error(guidance)
      if (d.state === 'limit') {
        if (intent.kind === 'feedback') throw new Error(guidance)
        if (typeof d.error !== 'string' || d.error.length > 4000 || typeof d.code !== 'string' || !['REQUEST_IMAGE_LIMIT', 'DAILY_IMAGE_LIMIT', 'MONTHLY_IMAGE_LIMIT', 'DAILY_CONCEPT_LIMIT'].includes(d.code) || (d.upgradeUrl !== undefined && d.upgradeUrl !== '/adimage/pricing') || (d.contactUrl !== undefined && d.contactUrl !== 'https://doyamarke.surisuta.jp/contact')) throw new Error(guidance)
        return d
      }
      if (d.state !== 'completed') { if (d.creatives !== undefined || d.conceptId !== undefined || d.previousCreatives !== undefined || d.feedbackId !== undefined || d.scores !== undefined || d.advice !== undefined || d.directives !== undefined) throw new Error(guidance); return d }
      const validVerification = (v: unknown) => {
        if (v === null) return true
        if (!v || typeof v !== 'object' || Array.isArray(v)) return false
        const value = v as Record<string, unknown>
        if (['ocrMatch', 'needsReview', 'safeAreaOk'].some(k => value[k] !== undefined && typeof value[k] !== 'boolean')) return false
        if (value.extraText !== undefined && (!Array.isArray(value.extraText) || value.extraText.length > 200 || value.extraText.some(t => typeof t !== 'string' || t.length > 2000))) return false
        if (value.detectedText !== undefined && (typeof value.detectedText !== 'string' || value.detectedText.length > 20000)) return false
        return value.retries === undefined || (Number.isSafeInteger(value.retries) && Number(value.retries) >= 0 && Number(value.retries) <= 5)
      }
      const validCreatives = (rows: unknown): rows is AdImageCreative[] => {
        const seen = new Set<string>()
        return Array.isArray(rows) && rows.length <= 10 && rows.every(c => {
          if (!c || !identifier(c.id) || seen.has(c.id) || !identifier(c.placementKey) || !validUrl(c.url) || !['placementName', 'media', 'size'].every(k => typeof c[k] === 'string' && c[k].length <= 200) || !validVerification(c.verify)) return false
          seen.add(c.id); return true
        })
      }
      if (!identifier(d.conceptId) || !identifier(d.campaignId) || !Number.isSafeInteger(d.generation) || d.generation! < 1 || !validCreatives(d.creatives) || !d.creatives.length || !validCreatives(d.previousCreatives) || typeof d.needsReview !== 'boolean' || !Array.isArray(d.failedPlacements) || d.failedPlacements.length > 10 || d.failedPlacements.some(v => typeof v !== 'string' || v.length > 160) || d.creatives.length + d.failedPlacements.length > 10) throw new Error(guidance)
      if (!d.copy || typeof d.copy !== 'object' || !['headline', 'sub', 'cta'].every(k => typeof (d.copy as unknown as Record<string, unknown>)[k] === 'string')) throw new Error(guidance)
      if (!Array.isArray(d.appliedDirectives) || d.appliedDirectives.length > 5 || !d.appliedDirectives.every(v => v && ['copy', 'color', 'layout', 'contrast', 'visual'].includes(v.target) && typeof v.instruction === 'string' && v.instruction.length <= 20000 && typeof v.reason === 'string' && v.reason.length <= 4000)) throw new Error(guidance)
      if (intent.kind === 'generate' && (d.generation !== 1 || d.previousGeneration !== null || d.previousCreatives.length || d.appliedDirectives.length)) throw new Error(guidance)
      if (intent.kind === 'refine' && (d.generation! < 2 || (d.previousGeneration !== null && (!Number.isSafeInteger(d.previousGeneration) || d.previousGeneration! !== d.generation! - 1)))) throw new Error(guidance)
      if ((intent.kind === 'refine' || intent.kind === 'feedback') && d.previousGeneration === null && d.previousCreatives.length) throw new Error(guidance)
      if (intent.kind === 'feedback') {
        if (d.conceptId !== intent.targetId || !identifier(d.feedbackId) || !identifier(d.creativeId) || !d.creatives.some(c => c.id === d.creativeId) || d.appliedDirectives.length || (d.previousGeneration !== null && (!Number.isSafeInteger(d.previousGeneration) || d.previousGeneration! < 1 || d.previousGeneration !== d.generation! - 1))) throw new Error(guidance)
        if (!d.scores || typeof d.scores !== 'object' || Array.isArray(d.scores)) throw new Error(guidance)
        const values = ['visibility', 'appeal', 'cta', 'fit', 'brand'].map(k => (d.scores as unknown as Record<string, unknown>)[k])
        if (values.some(v => typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) || d.scores.total !== values.reduce<number>((sum, v) => sum + Number(v), 0)) throw new Error(guidance)
        if (typeof d.advice !== 'string' || !d.advice.trim() || d.advice.length > 1000 || !Array.isArray(d.directives) || d.directives.length > 3 || !d.directives.every(v => v && ['copy', 'color', 'layout', 'contrast', 'visual'].includes(v.target) && typeof v.instruction === 'string' && v.instruction.trim() && v.instruction.length <= 500 && typeof v.reason === 'string' && v.reason.trim() && v.reason.length <= 500)) throw new Error(guidance)
      } else if (d.feedbackId !== undefined || d.scores !== undefined || d.advice !== undefined || d.directives !== undefined) throw new Error(guidance)
      return d
    })()
    return await Promise.race([reading, stopped])
  } catch { throw new Error(guidance) }
  finally { if (timer) clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort); void reader?.cancel().catch(() => {}) }
}
