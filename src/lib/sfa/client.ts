// ============================================
// ドヤ営業管理（SFA）クライアント用 fetch ヘルパー
// 現在のワークスペース(slug)を x-sfa-org ヘッダで送る
// ============================================

/**
 * fetch の init に x-sfa-org ヘッダを差し込む。
 * slug に日本語等の非ASCII文字が含まれると HTTP ヘッダ値(ByteString)に設定できず fetch が同期throwするため、
 * 必ず encodeURIComponent でエンコードして送る（サーバ側 orgSlugFrom でデコード）。
 */
export function sfaInit(orgSlug: string, init: RequestInit = {}): RequestInit {
  return {
    cache: 'no-store',
    ...init,
    headers: { 'x-sfa-org': encodeURIComponent(orgSlug || ''), ...(init.headers || {}) },
  }
}

/** ダウンロードリンク等、ヘッダを付けられない箇所向けに ?org= を付与 */
export function withOrg(url: string, orgSlug: string): string {
  if (!orgSlug) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}org=${encodeURIComponent(orgSlug)}`
}

/** Native select controls need every account, including records beyond the first API page. */
export async function fetchAllSfaAccounts(orgSlug: string, signal?: AbortSignal): Promise<Array<{ id: string; name: string }>> {
  const accounts = new Map<string, { id: string; name: string }>()
  const seenCursors = new Set<string>()
  let cursor: string | null = null
  do {
    const url: string = cursor ? `/api/sfa/accounts?options=1&cursor=${encodeURIComponent(cursor)}` : '/api/sfa/accounts?options=1'
    const response: Response = await fetch(url, sfaInit(orgSlug, { signal }))
    if (!response.ok) throw new Error('取引先の取得に失敗しました')
    const data: { accounts?: Array<{ id: string; name: string }>; nextCursor?: string | null } = await response.json()
    if (!data || !Array.isArray(data.accounts) || (data.nextCursor !== null && typeof data.nextCursor !== 'string')) {
      throw new Error('取引先の応答形式が不正です')
    }
    for (const account of data.accounts) {
      if (typeof account.id !== 'string' || typeof account.name !== 'string') throw new Error('取引先の応答形式が不正です')
      accounts.set(account.id, { id: account.id, name: account.name })
    }
    cursor = data.nextCursor || null
    if (cursor) {
      if (seenCursors.has(cursor)) throw new Error('取引先のページ情報が繰り返されています')
      seenCursors.add(cursor)
    }
  } while (cursor)
  return [...accounts.values()]
}
