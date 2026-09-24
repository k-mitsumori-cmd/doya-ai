export type AishodanPage<T> = {
  items: T[]
  total: number
  nextCursor: string | null
}

export function parseAishodanPage<T extends { id: string }>(
  data: unknown, key: string, pageSize: number
): AishodanPage<T> {
  const value = data as Record<string, unknown> | null
  const items = value?.[key]
  const total = value?.total
  const nextCursor = value?.nextCursor
  if (!Array.isArray(items) || items.length > pageSize ||
      !Number.isSafeInteger(total) || (total as number) < 0 ||
      items.length > (total as number) || (items.length === 0 && total !== 0) ||
      (nextCursor !== null && (typeof nextCursor !== 'string' || !nextCursor)) ||
      items.some((item) => !item || typeof item.id !== 'string' || !item.id) ||
      (nextCursor !== null && (items.length !== pageSize || nextCursor !== items[items.length - 1].id))) {
    throw new Error('商談一覧の応答が正しくありません')
  }
  return { items: items as T[], total: total as number, nextCursor: nextCursor as string | null }
}

export function appendAishodanPage<T extends { id: string }>(
  existing: T[], page: AishodanPage<T>, expectedTotal: number
): T[] {
  if (page.total !== expectedTotal) throw new Error('一覧が更新されました。再読み込みしてください')
  const ids = new Set(existing.map((item) => item.id))
  for (const item of page.items) {
    if (ids.has(item.id)) throw new Error('一覧が更新されました。再読み込みしてください')
    ids.add(item.id)
  }
  const merged = existing.concat(page.items)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('一覧を最後まで読み込めませんでした。再読み込みしてください')
  }
  return merged
}
