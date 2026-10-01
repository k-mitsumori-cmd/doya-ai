// ============================================
// ドヤ商談準備（Shodan）クライアント側 fetch ヘルパー
// 組織slugは ?org= で渡す（URL APIがデコードするのでヘッダの非ASCII問題を回避）。
// ※slugはASCIIのみ生成しているが、安全のため encodeURIComponent する。
// ============================================
function withOrg(path: string, orgSlug: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}org=${encodeURIComponent(orgSlug)}`
}

const READ_TIMEOUT_MS = 30_000
const WRITE_TIMEOUT_MS = 310_000 // API route maxDuration is 300 seconds.

async function requestJson(path: string, orgSlug: string, init: RequestInit, timeoutMs: number) {
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    const res = await fetch(withOrg(path, orgSlug), { ...init, signal })
    const data = await res.json().catch((error) => {
      if (signal.aborted) throw error
      return {}
    })
    return { res, data }
  } catch (error) {
    if (signal.aborted) throw new Error(timeoutMs === READ_TIMEOUT_MS
      ? '読み込みが時間内に完了しませんでした。再試行してください。'
      : '通信が時間内に完了しませんでした。操作履歴を確認してください。')
    throw error
  }
}

export class ShodanApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly actionUrl?: string,
    readonly actionLabel?: string,
  ) {
    super(message)
    this.name = 'ShodanApiError'
  }
}

export async function shodanGet<T = any>(path: string, orgSlug: string): Promise<T> {
  const { res, data } = await requestJson(path, orgSlug, { cache: 'no-store' }, READ_TIMEOUT_MS)
  if (!res.ok) throw new ShodanApiError((data as any)?.error || `取得に失敗しました (${res.status})`, res.status, (data as any)?.code)
  return data as T
}

export async function shodanSend<T = any>(
  path: string,
  orgSlug: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T> {
  const { res, data } = await requestJson(path, orgSlug, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  }, WRITE_TIMEOUT_MS)
  if (!res.ok) throw new ShodanApiError(
    (data as any)?.error || `操作に失敗しました (${res.status})`,
    res.status,
    (data as any)?.code,
    (data as any)?.upgradeUrl || (data as any)?.contactUrl,
    (data as any)?.upgradeUrl ? '料金プランを確認する' : (data as any)?.contactUrl ? '追加枠について問い合わせる' : undefined,
  )
  return data as T
}
