// ドヤ展示会の出展プロジェクトを、ブラウザ（localStorage）に残す。
// サーバーには保存しない暫定の手当て（本命の設計: docs/architecture/TENJIKAI-PERSISTENCE.md）。
// ⚠️ 利用者ごとにキーを分ける（同じ端末で別のアカウントに切り替えても、前の人の内容を出さない）。
// ⚠️ localStorage は読めない・書けないことがある（プライベート窓・容量超過）。すべて try/catch し、失敗しても画面は動かす。
import type { GeneratedPlan, ProjectInput } from './engine'

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

/** 保存した内容を読む。無い・壊れている・版が違うときは null */
export function loadProject(userId: string | null | undefined, store: KeyValueStore | null = browserStore()): SavedProject | null {
  if (!store) return null
  try {
    const raw = store.getItem(storeKey(userId))
    if (!raw) return null
    const p: unknown = JSON.parse(raw)
    if (!isRecord(p) || p.v !== STORE_VERSION) return null
    if (!isRecord(p.input) || !isRecord(p.generated) || !isRecord((p.generated as Record<string, unknown>).analysis)) return null
    if (p.variant !== 'A' && p.variant !== 'B' && p.variant !== 'C') return null
    if (!Array.isArray(p.selectedNovelty) || !p.selectedNovelty.every((x) => typeof x === 'string')) return null
    const images: Record<string, string> = {}
    if (isRecord(p.panelImages)) for (const [k, v] of Object.entries(p.panelImages)) if (typeof v === 'string') images[k] = v
    return { ...(p as unknown as SavedProject), panelImages: images }
  } catch {
    return null
  }
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
