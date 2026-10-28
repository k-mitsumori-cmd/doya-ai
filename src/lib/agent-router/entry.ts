// ============================================
// 組織ごとのツールの入口から、組織の中の画面へ「行き先」と「値」を運ぶ（画面に依らない純粋な部品）
// ============================================
// 例: /expense?to=new-contract&doya_amount=200000 → /expense/{slug}/contracts/new?doya_amount=200000
// ⚠️ 行き先は、ツールごとに決めた名前（allow）だけを受け付ける（好きなパスへは運ばない＝ open redirect にしない）。
// ⚠️ 運ぶ値は doya_ で始まる名前だけ。長さも切る（値の形は、受け取る画面が readPrefill で確かめる）。
import { PREFILL_PREFIX } from './prefill'

type ParamsLike = { get(name: string): string | null; forEach(cb: (value: string, key: string) => void): void }

/** サーバーの searchParams（Record）を URLSearchParams にする */
export function toSearchParams(sp: Record<string, string | string[] | undefined> | null | undefined): URLSearchParams {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (typeof v === 'string') q.set(k, v)
    else if (Array.isArray(v) && typeof v[0] === 'string') q.set(k, v[0])
  }
  return q
}

/**
 * 入口に来た ?to= と doya_* から、組織の中で開く「残りのパス」を作る（先頭は / か ''）。
 * allow: 行き先の名前 → 組織の中のパス（例: { 'new-contract': '/contracts/new' }）
 */
export function forwardPath(params: ParamsLike | null | undefined, allow: Record<string, string>): string {
  if (!params) return ''
  const to = params.get('to') ?? ''
  const sub = Object.prototype.hasOwnProperty.call(allow, to) ? allow[to] : ''
  const q = new URLSearchParams()
  let n = 0
  params.forEach((value, key) => {
    if (n >= 12 || !key.startsWith(PREFILL_PREFIX) || !/^doya_[a-z]{1,20}$/.test(key)) return
    q.set(key, value.slice(0, 2048)); n++
  })
  const qs = q.toString()
  if (!sub && !qs) return ''
  return `${sub}${qs ? `?${qs}` : ''}`
}

/** 画面で今の URL の検索の部分を読む。読めないとき（サーバー・試験の環境）は空にする（移動そのものは止めない） */
export function currentSearchParams(): URLSearchParams {
  try {
    return new URLSearchParams(typeof window === 'undefined' ? '' : window.location?.search ?? '')
  } catch {
    return new URLSearchParams()
  }
}
