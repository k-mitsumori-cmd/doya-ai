/**
 * ブラウザーからのエラー報告に足す、個人情報にならない決まった値（2026-11-22）。
 *
 * 11/22 12時台に「ブラウザー：非同期処理の未処理エラー」が1分おきに届いたが、報告に画面も種類も無く、
 * ログから原因を絞り込めなかった。次に出たときに「どの画面の、どの種類の失敗か」だけが分かるようにする。
 *
 * 送る値は2つだけで、どちらも決まった一覧の中の名前に限る。一覧に無い値は 'other' にする。
 * - 画面：URL の最初の区切り（/banner/dashboard/... なら 'banner'）。2番目以降の区切り・クエリ・URL の全体は送らない。
 * - 種類：失敗した値の型の名前（AbortError・TypeError など）。エラーの本文は送らない。
 * 利用者を見分けられる値（ID・メール・組織の名前・URL の全体）は、ここを通らない。
 */
import { SERVICES } from './services'

/** サービスの一覧（services.ts の href）にない、共通の画面の最初の区切り */
const SHARED_AREAS = ['home', 'hub', 'doyakun', 'pricing', 'auth', 'settings', 'billing', 'admin', 'm'] as const

export const CLIENT_ERROR_REASONS = [
  'AbortError', 'TimeoutError', 'TypeError', 'SyntaxError', 'RangeError', 'ReferenceError',
  'ChunkLoadError', 'NetworkError', 'NotAllowedError', 'QuotaExceededError', 'SecurityError',
  'Error', 'non-error',
] as const
export type ClientErrorReason = typeof CLIENT_ERROR_REASONS[number] | 'other'

let areaSet: Set<string> | null = null
function knownAreas(): Set<string> {
  if (!areaSet) {
    areaSet = new Set<string>(SHARED_AREAS)
    for (const service of SERVICES) {
      const match = /^\/([a-z0-9-]{1,32})(?:[/?#]|$)/.exec(service.href ?? '')
      if (match) areaSet.add(match[1])
    }
  }
  return areaSet
}

/** サーバー側で必ず通す。'top'（トップページ）・一覧の名前・'other' のどれかだけを返す。 */
export function normalizeClientErrorArea(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length > 40) return 'other'
  if (value === 'top') return 'top'
  return /^[a-z0-9-]{1,32}$/.test(value) && knownAreas().has(value) ? value : 'other'
}

/** サーバー側で必ず通す。決まった種類の名前・'other' のどれかだけを返す。 */
export function normalizeClientErrorReason(value: unknown): ClientErrorReason | null {
  if (value === undefined || value === null) return null
  return typeof value === 'string' && (CLIENT_ERROR_REASONS as readonly string[]).includes(value) ? value as ClientErrorReason : 'other'
}
