// ============================================
// 選んだ操作の値を、ツールの画面へ渡す（画面に依らない純粋な部品）
// ============================================
// 渡し方の決まり: 開く画面の URL に ?doya_<key>=<値> を足す。画面の側は readPrefill() で読む。
// ⚠️ 値は種類ごとに形を確かめてから渡す（AI の答えをそのまま画面に入れない）。形が違う値は捨てて「足りない」に回す。
// ⚠️ URL に載るので、個人の秘密になりうる長い文は載せない（longtext は 2,000 字まで）。
import type { AgentAction, AgentField, AgentFieldType } from './types'

export const PREFILL_PREFIX = 'doya_'
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

/** 開く画面の URL（値は doya_<key> で足す） */
export function prefillHref(action: Pick<AgentAction, 'path' | 'fields'>, values: Record<string, string>): string {
  const [path, query = ''] = action.path.split('?')
  const q = new URLSearchParams(query)
  for (const f of action.fields) {
    const v = values[f.key]
    if (v) q.set(PREFILL_PREFIX + f.key, v)
  }
  const qs = q.toString()
  return qs ? `${path}?${qs}` : path
}

/**
 * 画面の側で、渡された値を読む（URLSearchParams か、その get を持つもの）。
 * 種類を渡せば形も確かめる。無い・合わないときは ''。
 */
export function readPrefill(params: { get(name: string): string | null } | null | undefined, key: string, type: AgentFieldType = 'text'): string {
  if (!params) return ''
  return normalizeValue(type, params.get(PREFILL_PREFIX + key) ?? '')
}
