// 画面・API・外部サービスへの「読むだけ」の取得と、その結果を CheckOutcome にする部品。
import { bodySnippet, describeFetchError } from '@/lib/health-check-report'
import type { CheckOutcome } from './types'

export const FETCH_TIMEOUT_MS = 15_000
export const SLOW_MS = 8_000
const UA = 'DoyaAI-SystemWatch/1.0 (+https://doya-ai.surisuta.jp)'

/** サーバーの描画が失敗したときに本文へ出る文言（200 で返る場合もあるため本文も見る）。 */
const ERROR_PAGE_MARKERS = [/Application error: a (?:server|client)-side exception/i, /Internal Server Error/i, /This page could not be found/i, /ページを表示できませんでした/]

export type HttpExpect = {
  /** 期待する状態コード。省略時は 200 */
  status?: number | number[]
  /** 3xx を許す（同じサイト内への転送だけ） */
  allowRedirect?: boolean
  /** 本文の確認（false または文字列を返したら失敗。文字列はエラーの要約） */
  body?: (text: string, res: Response) => true | false | string
  headers?: Record<string, string>
  /** 画面として本文のエラー表示も見る */
  page?: boolean
}

export async function httpCheck(url: string, expect: HttpExpect = {}): Promise<CheckOutcome> {
  const started = Date.now()
  let res: Response
  try {
    res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'user-agent': UA, ...expect.headers } })
  } catch (e) {
    return { ok: false, url, error: describeFetchError(e, FETCH_TIMEOUT_MS), detail: `${Date.now() - started}ms で打ち切り` }
  }
  const ms = Date.now() - started
  const wanted = Array.isArray(expect.status) ? expect.status : [expect.status ?? 200]
  const isRedirect = res.status >= 300 && res.status < 400
  if (isRedirect && expect.allowRedirect) {
    const location = res.headers.get('location') ?? ''
    await res.body?.cancel().catch(() => {})
    const sameSite = location.startsWith('/') || new URL(location, url).host === new URL(url).host
    return sameSite
      ? { ok: true, url, status: res.status, detail: `${location} へ転送（${ms}ms）` }
      : { ok: false, url, status: res.status, error: `想定外のサイトへ転送されました: ${location.slice(0, 120)}` }
  }
  const text = await res.text().catch(() => '')
  if (!wanted.includes(res.status)) {
    return { ok: false, url, status: res.status, error: `HTTP ${res.status}（期待 ${wanted.join(' / ')}）${text ? `: ${bodySnippet(text, 160)}` : ''}`, detail: `${ms}ms` }
  }
  if (expect.page) {
    const marker = ERROR_PAGE_MARKERS.find(m => m.test(text))
    if (marker) return { ok: false, url, status: res.status, error: `画面にエラー表示が出ています: ${bodySnippet(text.match(marker)?.[0] ?? '', 80)}`, detail: `${ms}ms` }
    if (!/<\/html>/i.test(text)) return { ok: false, url, status: res.status, error: 'HTML が最後まで届いていません（描画の途中で止まった可能性）', detail: `${ms}ms、${text.length}文字` }
  }
  if (expect.body) {
    const verdict = expect.body(text, res)
    if (verdict !== true) return { ok: false, url, status: res.status, error: typeof verdict === 'string' ? verdict : `応答の中身が想定と違います: ${bodySnippet(text, 160)}`, detail: `${ms}ms` }
  }
  if (ms > SLOW_MS) return { ok: false, url, status: res.status, error: `応答が遅すぎます（${ms}ms、上限 ${SLOW_MS}ms）`, detail: `${ms}ms` }
  return { ok: true, url, status: res.status, detail: `HTTP ${res.status}（${ms}ms）` }
}

/** JSON を読んで中身を確かめる。 */
export function jsonBody(check: (json: any) => true | string): (text: string) => true | string {
  return (text: string) => {
    try {
      return check(JSON.parse(text))
    } catch {
      return `JSON として読めません: ${bodySnippet(text, 120)}`
    }
  }
}
