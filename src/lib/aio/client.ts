// ============================================
// ドヤAIO（AI可視性・AEO）クライアント側 fetch ヘルパー
// 組織slugは ?org= で渡す（URL APIがデコードするのでヘッダの非ASCII問題を回避）。
// 明示した組織scopeをURLSearchParamsで設定し、既存クエリのorgを置き換える。
// ============================================
import { requestOrgJson, OrgResponseError, orgErrorMessage, orgErrorCode, orgQuotaGuidance } from '../org-client-response'
import { confirmedOrgWrite, knownOrgWrite } from '../org-write-response'

export class AioApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly canManageBilling: boolean | null = null,
    public readonly upgradeUrl: string | null = null,
    public readonly contactUrl: string | null = null,
  ) {
    super(message)
    this.name = 'AioApiError'
  }
}

export async function aioGet<T = any>(path: string, orgSlug: string, options?: { signal?: AbortSignal }): Promise<T> {
  const { res, data } = await requestOrgJson('aio', path, orgSlug, { signal: options?.signal })
  if (!res.ok) throw new AioApiError(orgErrorMessage(data, res.status, false), res.status, orgErrorCode(data, res.status))
  return data as T
}

export async function aioSend<T = any>(
  path: string,
  orgSlug: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  options?: { signal?: AbortSignal }
): Promise<T> {
  if (!knownOrgWrite('aio', path, method)) throw new OrgResponseError(true)
  let payload: string | undefined
  let submitted: unknown
  try {
    payload = body != null ? JSON.stringify(body) : undefined
    submitted = payload === undefined ? undefined : JSON.parse(payload)
  } catch { throw new OrgResponseError(true) }
  const { res, data } = await requestOrgJson('aio', path, orgSlug, {
    method,
    signal: options?.signal,
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
  const guidance = orgQuotaGuidance(data, res.status, 'aio')
  if (!res.ok) throw new AioApiError(
    orgErrorMessage(data, res.status, true),
    res.status,
    orgErrorCode(data, res.status),
    guidance.canManageBilling ?? null,
    guidance.upgradeUrl ?? null,
    guidance.contactUrl ?? null,
  )
  if (!confirmedOrgWrite('aio', path, method, submitted, data)) throw new OrgResponseError(true, res.status)
  return data as T
}
