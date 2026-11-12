// ============================================
// 左のメニューの「よく使うツール」（docs/architecture/shell/FREQUENT-TOOLS-2026-11-12.md）
// ============================================
// 純粋な計算と、保存の形の読み書き・検査だけを置く（画面や storage には触れない）。
// 並びの決まり:
// - 直近30日のうち、ツールを開いた「日数」の多い順（同じ日に何度開いても1日）。2日以上のツールだけ。
// - 固定したツールが先、残りの枠によく使う順。最大5つ。
// - 並びは1日1回だけ作る（order.date がきょうなら、そのまま使う）。固定の切り替えのときだけ作り直す。
// ⚠️ 保存するのはツールの id と日付だけ。個人の情報は入れない。壊れた保存は捨てる。
export const FREQ_COOKIE = 'doya_shell_freq'
export const FREQ_KEY_PREFIX = 'doya-shell-freq-v1:'
export const FREQ_MAX = 5
export const FREQ_WINDOW_DAYS = 30
export const FREQ_MIN_DAYS = 2

export interface FrequentState {
  /** ツールの id → 開いた日（YYYY-MM-DD、JST。直近30日だけ） */
  days: Record<string, string[]>
  /** 自分で固定したツールの id（固定した順） */
  pinned: string[]
  /** その日の並び。date がきょうでなければ作り直す */
  order: { date: string; ids: string[] }
}

const ID_RE = /^[a-z0-9-]{1,32}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function emptyState(): FrequentState {
  return { days: {}, pinned: [], order: { date: '', ids: [] } }
}

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000)
}

/** b - a（日） */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a)
}

const uniq = (list: string[]) => list.filter((s, i) => list.indexOf(s) === i)

/** 保存された値を検査して取り出す。形が違うものは捨てる（壊れた保存は空に戻す） */
export function parseState(raw: string | null | undefined): FrequentState {
  if (!raw) return emptyState()
  let v: unknown
  try { v = JSON.parse(raw) } catch { return emptyState() }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return emptyState()
  const o = v as Record<string, unknown>
  const state = emptyState()
  if (o.days && typeof o.days === 'object' && !Array.isArray(o.days)) {
    for (const [id, list] of Object.entries(o.days as Record<string, unknown>)) {
      if (!ID_RE.test(id) || !Array.isArray(list)) continue
      const dates = uniq(list.filter((d): d is string => typeof d === 'string' && DATE_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)))).sort().slice(-FREQ_WINDOW_DAYS)
      if (dates.length) state.days[id] = dates
    }
  }
  if (Array.isArray(o.pinned)) state.pinned = uniq(o.pinned.filter((s): s is string => typeof s === 'string' && ID_RE.test(s))).slice(0, FREQ_MAX)
  const ord = o.order as { date?: unknown; ids?: unknown } | undefined
  if (ord && typeof ord.date === 'string' && DATE_RE.test(ord.date) && Array.isArray(ord.ids)) {
    state.order = { date: ord.date, ids: uniq(ord.ids.filter((s): s is string => typeof s === 'string' && ID_RE.test(s))).slice(0, FREQ_MAX) }
  }
  return state
}

export function serializeState(state: FrequentState): string {
  return JSON.stringify(state)
}

/** 30日（きょうを含む）より古い記録を捨てる */
export function pruneDays(days: Record<string, string[]>, today: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [id, list] of Object.entries(days)) {
    const kept = list.filter((d) => { return daysBetween(d, today) < FREQ_WINDOW_DAYS })
    if (kept.length) out[id] = kept
  }
  return out
}

/** ツールを開いたことを記録する（同じ日は1日と数える。古い記録も捨てる） */
export function recordVisit(state: FrequentState, toolId: string, today: string): FrequentState {
  if (!ID_RE.test(toolId)) return state
  const days = pruneDays(state.days, today)
  const list = days[toolId] ?? []
  if (!list.includes(today)) days[toolId] = [...list, today]
  return { ...state, days }
}

/** 開いた日数の多い順（2日以上のものだけ。同数なら直近に開いた順、それでも同じなら id 順） */
export function rankByDays(days: Record<string, string[]>, today: string, valid: ReadonlySet<string>): string[] {
  const fresh = pruneDays(days, today)
  return Object.entries(fresh)
    .filter(([id, list]) => valid.has(id) && list.length >= FREQ_MIN_DAYS)
    .sort(([ia, a], [ib, b]) => b.length - a.length || (a[a.length - 1] < b[b.length - 1] ? 1 : a[a.length - 1] > b[b.length - 1] ? -1 : 0) || (ia < ib ? -1 : 1))
    .map(([id]) => id)
}

/** 並びを作る（固定が先、残りの枠によく使う順。最大5つ） */
export function computeOrder(state: FrequentState, today: string, valid: ReadonlySet<string>): string[] {
  const pinned = state.pinned.filter((id) => valid.has(id)).slice(0, FREQ_MAX)
  const rest = rankByDays(state.days, today, valid).filter((id) => !pinned.includes(id))
  return [...pinned, ...rest].slice(0, FREQ_MAX)
}

/** その日の最初だけ並びを作る。きょうの並びがあれば、そのまま返す */
export function ensureOrder(state: FrequentState, today: string, valid: ReadonlySet<string>): FrequentState {
  if (state.order.date === today) return state
  return { ...state, days: pruneDays(state.days, today), order: { date: today, ids: computeOrder(state, today, valid) } }
}

/** 固定の切り替え。固定は最大5つ。すぐに並びを作り直す（本人の操作なので動いてよい） */
export function togglePin(state: FrequentState, toolId: string, today: string, valid: ReadonlySet<string>): { state: FrequentState; changed: boolean } {
  if (!ID_RE.test(toolId) || !valid.has(toolId)) return { state, changed: false }
  const has = state.pinned.includes(toolId)
  if (!has && state.pinned.filter((id) => valid.has(id)).length >= FREQ_MAX) return { state, changed: false }
  const pinned = has ? state.pinned.filter((id) => id !== toolId) : [...state.pinned, toolId]
  const next = { ...state, pinned }
  return { state: { ...next, order: { date: today, ids: computeOrder(next, today, valid) } }, changed: true }
}

// ---- cookie（サーバーが最初の描画から並べるため。中身は、きょうの並びと、先頭から何個が固定か） ----

/** アカウントの id の短いハッシュ（別のアカウントの並びを出さないための印。秘密ではない） */
export function actorHash(actorKey: string): string {
  let h = 5381
  for (let i = 0; i < actorKey.length; i++) h = ((h * 33) ^ actorKey.charCodeAt(i)) >>> 0
  return h.toString(36).slice(0, 8)
}

export function serializeFreqCookie(actorKey: string, ids: string[], pinnedCount: number): string {
  const safe = uniq(ids.filter((s) => ID_RE.test(s))).slice(0, FREQ_MAX)
  const pins = Math.max(0, Math.min(safe.length, Math.floor(pinnedCount) || 0))
  return encodeURIComponent(`${actorHash(actorKey)}.${safe.join(',')}.${pins}`)
}

export function parseFreqCookie(raw: string | null | undefined, actorKey: string): { ids: string[]; pinnedCount: number } {
  const none = { ids: [], pinnedCount: 0 }
  if (!raw || !actorKey) return none
  let text: string
  try { text = decodeURIComponent(raw) } catch { return none }
  const [hash, list, pins] = text.split('.')
  if (hash !== actorHash(actorKey)) return none
  const ids = uniq((list ?? '').split(',').filter((s) => ID_RE.test(s))).slice(0, FREQ_MAX)
  const n = Number(pins)
  return { ids, pinnedCount: Number.isInteger(n) ? Math.max(0, Math.min(ids.length, n)) : 0 }
}
