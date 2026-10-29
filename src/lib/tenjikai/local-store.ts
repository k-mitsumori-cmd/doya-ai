// ドヤ展示会の出展プロジェクトを、ブラウザ（localStorage）に残す。
// サーバーには保存しない暫定の手当て（本命の設計: docs/architecture/TENJIKAI-PERSISTENCE.md）。
// ⚠️ 利用者ごとにキーを分ける（同じ端末で別のアカウントに切り替えても、前の人の内容を出さない）。
// ⚠️ localStorage は読めない・書けないことがある（プライベート窓・容量超過）。すべて try/catch し、失敗しても画面は動かす。
import { BOOTH_SIZE_LIMIT, boothSize, isValidBoothMeter, type GeneratedPlan, type ProjectInput } from './engine'

export const STORE_VERSION = 1

export type SavedProject = {
  v: typeof STORE_VERSION
  savedAt: number
  input: ProjectInput
  generated: GeneratedPlan
  variant: 'A' | 'B' | 'C'
  selectedNovelty: string[]
  /** 面ごとの画像。URL（http / 相対）はそのまま、生成直後の data URL は容量が足りるときだけ残す */
  panelImages: Record<string, string>
}

/** localStorage と同じ形の最小の入れ物（テストで差し替える） */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const storeKey = (userId: string | null | undefined) => `doya:tenjikai:project:v${STORE_VERSION}:${userId || 'anon'}`

function browserStore(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const isDataUrl = (s: string) => s.startsWith('data:')

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const strings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string')
const positiveInteger = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const oneOf = (value: unknown, values: string[]) => typeof value === 'string' && values.includes(value)

function validInput(value: unknown): value is ProjectInput {
  if (!isRecord(value) || !strings(value, ['serviceUrl', 'eventName', 'venueId', 'eventStart'])) return false
  if (!oneOf(value.position, ['inline', 'corner', 'peninsula', 'island']) || !oneOf(value.goal, ['lead', 'brand', 'demo'])) return false
  if (!['days', 'komaCols', 'komaRows', 'staff'].every(key => positiveInteger(value[key]))) return false
  if (!finiteNumber(value.budgetYen) || (value.budgetYen as number) < 0) return false
  if (!['widthM', 'depthM'].every(key => value[key] === undefined || isValidBoothMeter(value[key]))) return false
  const size = boothSize(value as unknown as ProjectInput)
  if (![size.w, size.d].every(meters => Number.isFinite(meters) && meters >= BOOTH_SIZE_LIMIT.minM && meters <= BOOTH_SIZE_LIMIT.maxM)) return false
  const start = value.eventStart as string
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false
  const date = new Date(`${start}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === start
    && Number.isFinite(new Date(date.getTime() + (value.days as number) * 86_400_000).getTime())
}

function validCopy(value: unknown, keys: string[], fields: string[]): boolean {
  return isRecord(value) && keys.every(key => value[key] === undefined || (isRecord(value[key]) && strings(value[key], fields)))
}

function validGenerated(value: unknown): value is GeneratedPlan {
  if (!isRecord(value) || !oneOf(value.source, ['ai', 'mock']) || (value.notice !== undefined && typeof value.notice !== 'string')) return false
  const analysis = value.analysis
  if (!isRecord(analysis) || !strings(analysis, ['brand', 'domain', 'category', 'headline', 'subline', 'tone'])) return false
  if (!Array.isArray(analysis.valueProps) || analysis.valueProps.length < 3 || !analysis.valueProps.every(item => isRecord(item) && strings(item, ['title', 'body']))) return false
  if (!Array.isArray(analysis.targets) || !analysis.targets.every(item => typeof item === 'string')) return false
  if (!isRecord(analysis.colors) || !strings(analysis.colors, ['primary', 'secondary', 'accent'])) return false
  return validCopy(value.boothCopy, ['A', 'B', 'C'], ['name', 'concept', 'flow'])
    && validCopy(value.creativeCopy, ['backwall', 'rollup', 'flyer', 'clearfile', 'card', 'loop'], ['copy', 'purpose'])
}

export type ProjectLoadResult =
  | { status: 'ready'; project: SavedProject }
  | { status: 'missing' | 'invalid' | 'unavailable'; project: null }

/** Read without deleting or rewriting malformed content, so recovery can be retried. */
export function loadProjectResult(userId: string | null | undefined, store: KeyValueStore | null = browserStore()): ProjectLoadResult {
  if (!store) return { status: 'unavailable', project: null }
  let raw: string | null
  try { raw = store.getItem(storeKey(userId)) } catch { return { status: 'unavailable', project: null } }
  if (raw === null) return { status: 'missing', project: null }
  try {
    const p: unknown = JSON.parse(raw)
    if (!isRecord(p) || p.v !== STORE_VERSION || !finiteNumber(p.savedAt) || !validInput(p.input) || !validGenerated(p.generated)
      || !oneOf(p.variant, ['A', 'B', 'C']) || !Array.isArray(p.selectedNovelty) || !p.selectedNovelty.every(x => typeof x === 'string')) {
      return { status: 'invalid', project: null }
    }
    const images: Record<string, string> = {}
    if (isRecord(p.panelImages)) for (const [k, v] of Object.entries(p.panelImages)) if (typeof v === 'string') images[k] = v
    return { status: 'ready', project: { ...(p as unknown as SavedProject), panelImages: images } }
  } catch {
    return { status: 'invalid', project: null }
  }
}

/** Compatibility reader for callers that only need a valid saved project. */
export function loadProject(userId: string | null | undefined, store: KeyValueStore | null = browserStore()): SavedProject | null {
  return loadProjectResult(userId, store).project
}

export type SaveResult = 'saved' | 'saved-without-images' | 'failed'

/**
 * 保存する。容量が足りないときは、data URL の画像だけ外してもう一度試す。
 * 'saved-without-images' のときは、再読み込みで画像が消えることを画面で伝える。
 */
export function saveProject(userId: string | null | undefined, project: Omit<SavedProject, 'v' | 'savedAt'>, store: KeyValueStore | null = browserStore(), now = Date.now()): SaveResult {
  if (!store) return 'failed'
  const key = storeKey(userId)
  const base: SavedProject = { v: STORE_VERSION, savedAt: now, ...project }
  try {
    store.setItem(key, JSON.stringify(base))
    return 'saved'
  } catch {
    // 容量超過など。画像を外して再挑戦
  }
  const light: Record<string, string> = {}
  let dropped = false
  for (const [k, v] of Object.entries(project.panelImages)) {
    if (isDataUrl(v)) dropped = true
    else light[k] = v
  }
  try {
    store.setItem(key, JSON.stringify({ ...base, panelImages: light }))
    return dropped ? 'saved-without-images' : 'saved'
  } catch {
    return 'failed'
  }
}

export function clearProject(userId: string | null | undefined, store: KeyValueStore | null = browserStore()): void {
  try {
    store?.removeItem(storeKey(userId))
  } catch {
    // 消せなくても続ける
  }
}
