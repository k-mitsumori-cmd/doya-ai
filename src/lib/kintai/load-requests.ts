export type KintaiRequestPage<T> = {
  requests: T[]
  nextCursor: string | null
  total: number
  counts: Record<string, number>
}

export function validateKintaiRequestPage<T extends { id: string }>(page: KintaiRequestPage<T>): KintaiRequestPage<T> {
  if (!page || !Array.isArray(page.requests) || page.requests.length > 100 ||
    !Number.isSafeInteger(page.total) || page.total < 0 ||
    !page.counts || typeof page.counts !== 'object' || Array.isArray(page.counts) ||
    Object.values(page.counts).some((count) => !Number.isSafeInteger(count) || count < 0) ||
    (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor)) ||
    page.requests.some((request) => !request || typeof request.id !== 'string' || !request.id) ||
    (page.nextCursor !== null && (page.requests.length !== 100 || page.nextCursor !== page.requests[page.requests.length - 1]?.id))) {
    throw new Error('申請一覧を正しく読み込めませんでした。もう一度お試しください。')
  }
  return page
}

export function appendKintaiRequestPage<T extends { id: string }>(
  existing: T[], page: KintaiRequestPage<T>, expectedTotal: number
): T[] {
  validateKintaiRequestPage(page)
  if (page.total !== expectedTotal) throw new Error('読み込みの間に申請一覧が変わりました。もう一度読み込んでください。')
  const ids = new Set(existing.map((request) => request.id))
  for (const request of page.requests) {
    if (ids.has(request.id)) throw new Error('申請一覧を正しく読み込めませんでした。もう一度お試しください。')
    ids.add(request.id)
  }
  const merged = existing.concat(page.requests)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('申請一覧の一部を読み込めませんでした。もう一度お試しください。')
  }
  return merged
}

export async function fetchKintaiRequestPage<T extends { id: string }>(status: string, cursor: string | null = null): Promise<KintaiRequestPage<T>> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (cursor) params.set('cursor', cursor)
  const response = await fetch(`/api/kintai/requests${params.size ? `?${params}` : ''}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('申請一覧を読み込めませんでした。少し待って、もう一度お試しください。')
  const page = validateKintaiRequestPage<T>(await response.json())
  const count = status ? page.counts[status] || 0 : Object.values(page.counts).reduce((sum, value) => sum + value, 0)
  if (page.total !== count) throw new Error('読み込みの間に申請一覧が変わりました。もう一度読み込んでください。')
  return page
}
