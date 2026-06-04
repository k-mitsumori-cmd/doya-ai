// ============================================
// ドヤ営業管理（SFA）クライアント用 fetch ヘルパー
// 現在のワークスペース(slug)を x-sfa-org ヘッダで送る
// ============================================

/** fetch の init に x-sfa-org ヘッダを差し込む */
export function sfaInit(orgSlug: string, init: RequestInit = {}): RequestInit {
  return {
    cache: 'no-store',
    ...init,
    headers: { 'x-sfa-org': orgSlug, ...(init.headers || {}) },
  }
}

/** ダウンロードリンク等、ヘッダを付けられない箇所向けに ?org= を付与 */
export function withOrg(url: string, orgSlug: string): string {
  if (!orgSlug) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}org=${encodeURIComponent(orgSlug)}`
}
