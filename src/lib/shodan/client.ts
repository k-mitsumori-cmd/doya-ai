// ============================================
// ドヤ商談準備（Shodan）クライアント側 fetch ヘルパー
// 組織slugは ?org= で渡す（URL APIがデコードするのでヘッダの非ASCII問題を回避）。
// ※slugはASCIIのみ生成しているが、安全のため encodeURIComponent する。
// ============================================
function withOrg(path: string, orgSlug: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}org=${encodeURIComponent(orgSlug)}`
}

export async function shodanGet<T = any>(path: string, orgSlug: string): Promise<T> {
  const res = await fetch(withOrg(path, orgSlug), { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any)?.error || `取得に失敗しました (${res.status})`)
  return data as T
}

export async function shodanSend<T = any>(
  path: string,
  orgSlug: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T> {
  const res = await fetch(withOrg(path, orgSlug), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any)?.error || `操作に失敗しました (${res.status})`)
  return data as T
}
