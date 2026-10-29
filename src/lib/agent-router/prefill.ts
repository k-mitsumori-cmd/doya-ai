// ============================================
// 選んだ操作の値を、ツールの画面へ渡す（画面に依らない純粋な部品）
// ============================================
// 渡し方の決まり: 値は sessionStorage に入れ、開く画面の URL には一度きりの鍵（?doya_k=）だけを付ける。画面の側は useDoyaPrefill で読む。
// ⚠️ 値は種類ごとに形を確かめてから渡す（AI の答えをそのまま画面に入れない）。形が違う値は捨てて「足りない」に回す。
// ⚠️ 値は URL に載せない（分析の送り先に名前や金額を送らないため）。longtext は 2,000 字まで。
import type { AgentAction, AgentField, AgentFieldType } from './types'

const MAX_YEN = 10_000_000_000

/** 1つの値を、その種類の形にそろえる。合わなければ '' */
export function normalizeValue(type: AgentFieldType, raw: unknown): string {
  if (typeof raw !== 'string' && typeof raw !== 'number') return ''
  const s = String(raw).normalize('NFKC').trim()
  if (!s) return ''
  switch (type) {
    case 'yen': {
      const n = Number(s.replace(/[,円¥\s]/g, ''))
      return Number.isSafeInteger(n) && n > 0 && n <= MAX_YEN ? String(n) : ''
    }
    case 'number': {
      const n = Number(s.replace(/,/g, ''))
      return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? String(n) : ''
    }
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
      const d = new Date(`${s}T00:00:00Z`)
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : ''
    }
    case 'url': {
      try {
        const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`)
        if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || !u.hostname.includes('.')) return ''
        return u.toString().slice(0, 2048)
      } catch {
        return ''
      }
    }
    case 'email':
      return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s) ? s.slice(0, 320) : ''
    case 'longtext':
      return s.slice(0, 2000)
    case 'text':
    default:
      return s.replace(/\s+/g, ' ').slice(0, 200)
  }
}

/** 操作の欄に合う値だけを残す（知らない名前の値は捨てる） */
export function cleanValues(action: Pick<AgentAction, 'fields'>, raw: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of action.fields) {
    const v = normalizeValue(f.type, raw?.[f.key])
    if (v) out[f.key] = v
  }
  return out
}

/** まだ入っていない、必ず要る欄 */
export function missingFields(action: Pick<AgentAction, 'fields'>, values: Record<string, string>): AgentField[] {
  return action.fields.filter((f) => f.required && !values[f.key])
}

/** 開く画面のパス（値は載せない。値は stashPrefill で渡す） */
export function actionPath(action: Pick<AgentAction, 'path'>): string {
  return action.path
}

// ---- 値は URL に載せない（2026-10-29 統括の監査 中1）----
// URL に載せると、GA4・HubSpot・doya_attr の cookie に、取引先・候補者の名前や金額が送られうる。
// そこで値は同じタブの sessionStorage に、意味のない一度きりの鍵で入れ、URL には鍵（doya_k）だけを付ける。
// 受け取る画面は takePrefill で1回だけ読み、すぐ消す（URL の鍵も history.replaceState で消す）。
export const PREFILL_KEY_PARAM = 'doya_k'
const STORE_PREFIX = 'doya-prefill:'
/** 鍵の有効期限（開くまでの時間。長くは置かない） */
export const PREFILL_TTL_MS = 10 * 60 * 1000

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 鍵の形（英数字・- ・_ の 16〜40 字）。ほかの形は読まない */
export function isPrefillKey(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(v)
}

/** 値を入れて、鍵を返す。値が無い・入れられないときは ''（鍵を付けずに画面を開く） */
export function stashPrefill(values: Record<string, string>, storage: StorageLike | null | undefined, now = Date.now(), makeKey: () => string = randomKey): string {
  const clean = Object.fromEntries(Object.entries(values ?? {}).filter(([k, v]) => /^[a-z]{1,20}$/.test(k) && typeof v === 'string' && v.length > 0 && v.length <= 2048))
  if (!storage || Object.keys(clean).length === 0) return ''
  const key = makeKey()
  if (!isPrefillKey(key)) return ''
  try {
    storage.setItem(STORE_PREFIX + key, JSON.stringify({ v: clean, exp: now + PREFILL_TTL_MS }))
    return key
  } catch {
    return ''
  }
}

/** 鍵で値を1回だけ取り出す（取り出したら消す）。無い・期限切れ・形が違うときは空 */
export function takePrefill(key: string | null | undefined, storage: StorageLike | null | undefined, now = Date.now()): Record<string, string> {
  if (!isPrefillKey(key) || !storage) return {}
  let raw: string | null = null
  try {
    raw = storage.getItem(STORE_PREFIX + key)
    storage.removeItem(STORE_PREFIX + key)
  } catch {
    return {}
  }
  if (!raw) return {}
  try {
    const d = JSON.parse(raw) as { v?: unknown; exp?: unknown }
    if (typeof d.exp !== 'number' || d.exp < now || !d.v || typeof d.v !== 'object' || Array.isArray(d.v)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(d.v as Record<string, unknown>)) if (/^[a-z]{1,20}$/.test(k) && typeof v === 'string') out[k] = v
    return out
  } catch {
    return {}
  }
}

/** 開く URL（値があれば鍵だけを付ける） */
export function withPrefillKey(path: string, key: string): string {
  if (!isPrefillKey(key)) return path
  return `${path}${path.includes('?') ? '&' : '?'}${PREFILL_KEY_PARAM}=${key}`
}

function randomKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '')
  const a = new Uint8Array(16)
  c?.getRandomValues?.(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}
