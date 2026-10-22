import type { AskLinkCreationState } from './creation-operation'

export type AskLinkCreationIntent = { version: 1; operationId: string; fingerprint: string; createdAt: string }
export type AskLinkCreationDraft = { url: string; manualText: string; needManual: boolean }
const operationId = /^\d{13}\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const fingerprint = /^[a-f0-9]{64}$/
export const ASKLINK_INTENT_STORAGE_ERROR = '操作情報を安全に保存・確認できません。新しく作成せず、ブラウザの設定と履歴を確認してください。'
export function askLinkIntentKey(actor: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(actor)) throw Error('ログイン状態を確認してください。')
  return 'asklink-create-intent:v2:' + actor
}
function validIntent(row: unknown): row is AskLinkCreationIntent {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false
  const r = row as AskLinkCreationIntent
  return Object.keys(row).every(k => ['version', 'operationId', 'fingerprint', 'createdAt'].includes(k)) && r.version === 1 && operationId.test(r.operationId) && fingerprint.test(r.fingerprint) && typeof r.createdAt === 'string' && Number.isFinite(Date.parse(r.createdAt)) && new Date(r.createdAt).toISOString() === r.createdAt
}
/** Only IDs/hashes enter cross-tab storage; URL and manual text stay in this tab's draft. */
export function readAskLinkCreationIntent(actor: string): AskLinkCreationIntent | null {
  try {
    const raw = localStorage.getItem(askLinkIntentKey(actor))
    if (raw === null) return null
    if (raw.length > 2048) throw Error()
    const row: unknown = JSON.parse(raw)
    if (!validIntent(row)) throw Error()
    return row
  } catch { throw Error(ASKLINK_INTENT_STORAGE_ERROR) }
}
export function normalizeAskLinkClientInput(url: string, manualText: string) {
  const raw = url.trim()
  if (!raw || raw.length > 2000) throw Error('サイトのURLを正しく入力してください。')
  let value: URL
  try { value = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw) } catch { throw Error('サイトのURLを正しく入力してください。') }
  if (!['http:', 'https:'].includes(value.protocol) || !value.hostname.includes('.') || value.username || value.password) throw Error('サイトのURLを正しく入力してください。')
  value.hash = ''
  if (value.toString().length > 2000) throw Error('サイトのURLが長すぎます。短いURLを入力してください。')
  const text = manualText.trim()
  if (text && (text.length < 20 || text.length > 3000)) throw Error('サービスの説明は20〜3000字で入力してください。')
  return { sourceUrl: value.toString(), manualText: text }
}
export async function askLinkClientFingerprint(input: { sourceUrl: string; manualText: string }) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([input.sourceUrl, input.manualText])))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
async function locked<T>(actor: string, signal: AbortSignal, action: () => T): Promise<T> {
  if (signal.aborted || !navigator.locks) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined, stop = () => {}
  const stopped = new Promise<never>((_, reject) => {
    stop = () => { controller.abort(); reject(Error(ASKLINK_INTENT_STORAGE_ERROR)) }
    signal.addEventListener('abort', stop, { once: true })
    timer = setTimeout(stop, 10_000)
  })
  try {
    return await Promise.race([navigator.locks.request(askLinkIntentKey(actor), { mode: 'exclusive', signal: controller.signal }, () => {
      if (signal.aborted || controller.signal.aborted) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
      return action()
    }), stopped])
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); controller.abort() }
}
export async function claimAskLinkCreationIntent(actor: string, inputFingerprint: string, signal: AbortSignal) {
  if (!fingerprint.test(inputFingerprint)) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
  return locked(actor, signal, () => {
    const previous = readAskLinkCreationIntent(actor)
    if (previous) return { intent: previous, created: false }
    const intent: AskLinkCreationIntent = { version: 1, operationId: Date.now() + '.' + crypto.randomUUID(), fingerprint: inputFingerprint, createdAt: new Date().toISOString() }
    if (!validIntent(intent)) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
    localStorage.setItem(askLinkIntentKey(actor), JSON.stringify(intent))
    if (JSON.stringify(readAskLinkCreationIntent(actor)) !== JSON.stringify(intent)) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
    return { intent, created: true }
  })
}
/** Caller must have verified a terminal result, and request an explicit new creation. */
export async function releaseAskLinkCreationIntent(actor: string, intent: AskLinkCreationIntent, signal: AbortSignal) {
  return locked(actor, signal, () => {
    const current = readAskLinkCreationIntent(actor)
    if (!validIntent(intent) || current?.operationId !== intent.operationId || current.fingerprint !== intent.fingerprint) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
    localStorage.removeItem(askLinkIntentKey(actor))
    if (readAskLinkCreationIntent(actor) !== null) throw Error(ASKLINK_INTENT_STORAGE_ERROR)
  })
}
export function readAskLinkCreationDraft(actor: string): AskLinkCreationDraft {
  try {
    const raw = sessionStorage.getItem(askLinkIntentKey(actor) + ':draft')
    if (raw === null) return { url: '', manualText: '', needManual: false }
    if (raw.length > 20_000) throw Error()
    const r = JSON.parse(raw) as AskLinkCreationDraft
    if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).some(k => !['url', 'manualText', 'needManual'].includes(k)) || typeof r.url !== 'string' || r.url.length > 2000 || typeof r.manualText !== 'string' || r.manualText.length > 3000 || typeof r.needManual !== 'boolean') throw Error()
    return r
  } catch { throw Error(ASKLINK_INTENT_STORAGE_ERROR) }
}
export function writeAskLinkCreationDraft(actor: string, draft: AskLinkCreationDraft) {
  try {
    const encoded = JSON.stringify(draft)
    if (encoded.length > 20_000 || draft.url.length > 2000 || draft.manualText.length > 3000) throw Error()
    sessionStorage.setItem(askLinkIntentKey(actor) + ':draft', encoded)
    if (JSON.stringify(readAskLinkCreationDraft(actor)) !== encoded) throw Error()
  } catch { throw Error(ASKLINK_INTENT_STORAGE_ERROR) }
}
/** A missing operation has no input hash; every accepted operation is bound to the saved hash. */
export function parseAskLinkCreationState(data: unknown, intent: AskLinkCreationIntent): AskLinkCreationState {
  const r = (data as { operation?: AskLinkCreationState } | null)?.operation
  if (!r || typeof r !== 'object' || Array.isArray(r) || r.operationId !== intent.operationId || !['pending', 'completed', 'failed', 'canceled', 'superseded', 'missing', 'unknown', 'deleted', 'expired'].includes(r.state) || typeof r.reserved !== 'boolean' || typeof r.canFinalize !== 'boolean' || !(r.runId === null || typeof r.runId === 'string' && /^[a-z0-9]{20,40}$/i.test(r.runId)) || !(r.fingerprint === intent.fingerprint || ['missing', 'canceled', 'expired'].includes(r.state) && r.fingerprint === null) || ![null, 'QUOTA_REACHED', 'WEBSITE_UNREADABLE', 'GENERATION_FAILED', 'OPERATION_EXPIRED'].includes(r.failure)) throw Error('作成状態を確認できません。新しく作成せず、再確認してください。')
  if (r.state === 'completed' && (!r.runId || !r.reserved || r.failure !== null)) throw Error('保存結果を確認できません。')
  if (['missing', 'canceled', 'failed', 'expired'].includes(r.state) && (r.runId !== null || r.reserved)) throw Error('作成状態を確認できません。')
  if (r.state === 'failed' ? r.failure === null : r.failure !== null) throw Error('作成状態を確認できません。')
  if (r.failure === 'QUOTA_REACHED') {
    if (!r.quota || r.quota.ok !== false || typeof r.quota.reason !== 'string' || !Number.isSafeInteger(r.quota.used) || Number(r.quota.used) < 0 || !Number.isSafeInteger(r.quota.limit) || Number(r.quota.limit) < 1) throw Error('利用枠を確認できません。')
  } else if (r.quota !== null) throw Error('利用枠を確認できません。')
  if (r.state === 'unknown' ? !r.canFinalize : r.canFinalize) throw Error('作成状態を確認できません。')
  return r
}
