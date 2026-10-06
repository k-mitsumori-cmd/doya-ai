// ============================================
// ドヤ商談準備（Shodan）クライアント側 fetch ヘルパー
// 組織slugは ?org= で渡す（URL APIがデコードするのでヘッダの非ASCII問題を回避）。
// 明示した組織scopeをURLSearchParamsで設定し、既存クエリのorgを置き換える。
// ============================================
import { requestOrgJson, OrgResponseError, orgErrorMessage, orgErrorCode, orgQuotaGuidance } from '../org-client-response'
import { confirmedOrgWrite, knownOrgWrite } from '../org-write-response'

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

export async function shodanGet<T = any>(path: string, orgSlug: string, options?: { signal?: AbortSignal }): Promise<T> {
  const { res, data } = await requestOrgJson('shodan', path, orgSlug, { signal: options?.signal })
  if (!res.ok) throw new ShodanApiError(orgErrorMessage(data, res.status, false), res.status, orgErrorCode(data, res.status) ?? undefined)
  return data as T
}

export async function shodanSend<T = any>(
  path: string,
  orgSlug: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: { signal?: AbortSignal }
): Promise<T> {
  if (!knownOrgWrite('shodan', path, method)) throw new OrgResponseError(true)
  let payload: string | undefined
  let submitted: unknown
  try {
    payload = body != null ? JSON.stringify(body) : undefined
    submitted = payload === undefined ? undefined : JSON.parse(payload)
  } catch { throw new OrgResponseError(true) }
  const { res, data } = await requestOrgJson('shodan', path, orgSlug, {
    method,
    signal: options?.signal,
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
  const guidance = orgQuotaGuidance(data, res.status, 'shodan')
  if (!res.ok) throw new ShodanApiError(
    orgErrorMessage(data, res.status, true),
    res.status,
    orgErrorCode(data, res.status) ?? undefined,
    guidance.upgradeUrl ?? guidance.contactUrl,
    guidance.upgradeUrl ? '料金プランを確認する' : guidance.contactUrl ? '追加枠について問い合わせる' : undefined,
  )
  if (!confirmedOrgWrite('shodan', path, method, submitted, data)) throw new OrgResponseError(true, res.status)
  return data as T
}
