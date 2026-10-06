export const DOYALIST_COLLECTION_UNKNOWN = '作成・保存結果を確認できませんでした。保存済みのプロジェクトを確認してから、再度お試しください。'

export function parseCollectionUsage(value: unknown): { tier: string; limit: number; remaining: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, any>
  const tier = data.plan?.tier, used = data.usage?.companiesGenerated
  const limit = data.limits?.maxCompaniesPerMonth, remaining = data.remaining?.companies
  if (data.success !== true || data.error !== undefined || data.code !== undefined ||
      !['GUEST', 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE'].includes(tier) ||
      !Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(limit) || limit < -1 ||
      !Number.isSafeInteger(remaining) || remaining !== (limit === -1 ? -1 : Math.max(0, limit - used))) return null
  return { tier, limit, remaining }
}

export function validCollectionResult(value: unknown, requested: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, any>
  if (data.success !== true || data.error !== undefined || data.code !== undefined ||
      !Array.isArray(data.companies) || data.companies.length === 0 || data.companies.length > requested ||
      data.generated !== data.companies.length || (data.warning !== undefined && typeof data.warning !== 'string')) return false
  const strings = ['id', 'website', 'industry', 'region', 'size', 'description', 'contactPerson', 'source']
  const enrichedStrings = ['corporateNumber', 'address', 'prefecture', 'representative', 'capital', 'employeeCount', 'businessSummary', 'industry']
  return data.companies.every((company: any) => {
    if (!company || typeof company !== 'object' || Array.isArray(company) || typeof company.name !== 'string' || !company.name.trim()) return false
    if (strings.some(field => company[field] != null && typeof company[field] !== 'string')) return false
    const ed = company.enrichedData
    return ed == null || (typeof ed === 'object' && !Array.isArray(ed) &&
      enrichedStrings.every(field => ed[field] == null || typeof ed[field] === 'string') &&
      (ed.foundedYear == null || typeof ed.foundedYear === 'string' || (typeof ed.foundedYear === 'number' && Number.isFinite(ed.foundedYear))))
  })
}

/** Allow large streamed company lists; cancellation never proves server rollback. */
export async function readCollectionResponse(init: RequestInit, signal: AbortSignal) {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let rejectStop: (error: Error) => void = () => {}
  const stop = new Promise<never>((_, reject) => { rejectStop = reject })
  const cancel = () => { controller.abort(); void reader?.cancel().catch(() => {}); rejectStop(new Error(DOYALIST_COLLECTION_UNKNOWN)) }
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, 310000)
  try {
    if (signal.aborted) { cancel(); return await stop }
    return await Promise.race([stop, (async () => {
      const res = await fetch('/api/doyalist/collect', { ...init, cache: 'no-store', signal: controller.signal })
      const maxBytes = 64 * 1024 * 1024
      if (controller.signal.aborted || !res.body || Number(res.headers.get('content-length')) > maxBytes) throw new Error(DOYALIST_COLLECTION_UNKNOWN)
      reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let text = '', bytes = 0
      while (true) {
        const chunk = await reader.read()
        if (controller.signal.aborted) throw new Error(DOYALIST_COLLECTION_UNKNOWN)
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > maxBytes) throw new Error(DOYALIST_COLLECTION_UNKNOWN)
        text += decoder.decode(chunk.value, { stream: true })
      }
      text += decoder.decode()
      const data: unknown = JSON.parse(text)
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(DOYALIST_COLLECTION_UNKNOWN)
      return { ok: res.ok, status: res.status, data: data as Record<string, any> }
    })()])
  } catch { throw new Error(DOYALIST_COLLECTION_UNKNOWN) } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort()
    void reader?.cancel().catch(() => {})
    try { reader?.releaseLock() } catch { /* Pending cancellation settles separately. */ }
  }
}
