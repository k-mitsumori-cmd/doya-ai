export const ORG_READ_TIMEOUT_MS = 30_000
export const ORG_WRITE_TIMEOUT_MS = 310_000
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

export class OrgResponseError extends Error {
  readonly code = 'RESPONSE_UNCONFIRMED'
  constructor(readonly writing: boolean, readonly status = 0, timedOut = false) {
    super(writing
      ? '操作結果を確認できませんでした。重ねて操作する前に、保存済みの設定・一覧・操作履歴を確認してください。'
      : timedOut ? '読み込みが時間内に完了しませんでした。再試行してください。' : '応答を確認できませんでした。再度読み込んでください。')
    this.name = 'OrgResponseError'
  }
}

/** Bound both fetch and streaming body; an unconfirmed write must never be silently retried. */
export async function requestOrgJson(service: 'aio' | 'shodan' | 'quote', path: string, orgSlug: string | null, init: RequestInit = {}) {
  const writing = !!init.method && init.method !== 'GET'
  const timeoutMs = writing ? ORG_WRITE_TIMEOUT_MS : ORG_READ_TIMEOUT_MS
  const outerSignal = init.signal
  if (outerSignal?.aborted || orgSlug !== null && (typeof orgSlug !== 'string' || !orgSlug)) throw new OrgResponseError(writing)
  let url: URL
  try { url = new URL(path, 'https://org-client.invalid') } catch { throw new OrgResponseError(writing) }
  if (url.origin !== 'https://org-client.invalid' || !url.pathname.startsWith(`/api/${service}/`) || url.hash) throw new OrgResponseError(writing)
  // Replace any earlier org query so the explicit current scope always wins.
  if (orgSlug === null) {
    if (service !== 'quote' || url.pathname !== '/api/quote/organizations') throw new OrgResponseError(writing)
    url.searchParams.delete('org')
  } else url.searchParams.set('org', orgSlug)
  const controller = new AbortController()
  let response: Response | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new OrgResponseError(writing, response?.status)) }
    outerSignal?.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new OrgResponseError(writing, response?.status, true)) }, timeoutMs)
  })
  const work = (async () => {
    response = await fetch(url.pathname + url.search, { ...init, cache: 'no-store', signal: controller.signal })
    if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw new OrgResponseError(writing, response.status) }
    if (!response.body || Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new OrgResponseError(writing, response.status)
    reader = response.body.getReader()
    let bytes = new Uint8Array(64 * 1024)
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (controller.signal.aborted) throw new OrgResponseError(writing, response.status)
      if (chunk.done) break
      const nextSize = size + chunk.value.byteLength
      if (nextSize > MAX_RESPONSE_BYTES) throw new OrgResponseError(writing, response.status)
      if (nextSize > bytes.byteLength) {
        const grown = new Uint8Array(Math.min(MAX_RESPONSE_BYTES, Math.max(nextSize, bytes.byteLength * 2)))
        grown.set(bytes.subarray(0, size))
        bytes = grown
      }
      bytes.set(chunk.value, size)
      size = nextSize
    }
    let data: Record<string, unknown>
    try {
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)))
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new Error()
      data = value as Record<string, unknown>
    } catch {
      // Keep a definite HTTP rejection as a rejection even when its body is HTML/invalid.
      if (response.ok) throw new OrgResponseError(writing, response.status)
      data = {}
    }
    return { res: response, data }
  })()
  try {
    return await Promise.race([work, stop])
  } catch (error) {
    if (error instanceof OrgResponseError) throw error
    throw new OrgResponseError(writing, response?.status)
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', cancel)
    controller.abort()
    try {
      if (reader) void reader.cancel().catch(() => {})
      else void response?.body?.cancel().catch(() => {})
    } catch {}
  }
}

export function orgErrorMessage(data: Record<string, unknown>, status: number, writing: boolean) {
  if (status < 500 && typeof data.error === 'string' && data.error.length <= 800 && !/[\u0000-\u001f<>]/.test(data.error)) return data.error
  return writing ? '操作が完了したか確認できませんでした。保存済みの設定・一覧・操作履歴を確認してください。' : 'データを取得できませんでした。時間をおいて再度読み込んでください。'
}

export function orgErrorCode(data: Record<string, unknown>, status: number): string | null {
  if (status >= 500 || typeof data.code !== 'string' || !/^[A-Z0-9_]{1,80}$/.test(data.code)) return null
  if (data.code === 'LIMIT' && ![402, 429].includes(status) || data.code === 'PLAN' && status !== 402) return null
  return data.code
}

export function orgQuotaGuidance(data: Record<string, unknown>, status: number, service: 'aio' | 'shodan' | 'quote') {
  const code = orgErrorCode(data, status)
  if (![402, 429].includes(status) || !(service === 'quote' ? ['LIMIT_REACHED'] : ['LIMIT', 'PLAN']).includes(code || '')) return {}
  const canManageBilling = typeof data.canManageBilling === 'boolean' ? data.canManageBilling : undefined
  if (canManageBilling === false || service === 'quote' && canManageBilling !== true) return { canManageBilling }
  return { canManageBilling, upgradeUrl: orgActionUrl(data.upgradeUrl, service, 'upgrade'), contactUrl: orgActionUrl(data.contactUrl, service, 'contact') }
}

export function orgActionUrl(raw: unknown, service: 'aio' | 'shodan' | 'quote', kind: 'upgrade' | 'contact'): string | undefined {
  if (typeof raw !== 'string' || raw.length > 2_048) return undefined
  try {
    const url = new URL(raw, 'https://org-client.invalid')
    if (url.username || url.password) return undefined
    if (kind === 'upgrade') return raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && url.origin === 'https://org-client.invalid' && url.pathname === `/${service}/pricing` ? raw : undefined
    return url.protocol === 'https:' ? raw : undefined
  } catch { return undefined }
}
