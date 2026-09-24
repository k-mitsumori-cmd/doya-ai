export type PreparationPage<T> = {
  items: T[]
  nextCursor: string | null
  total: number
}

export function parsePreparationPage<T extends { id: string }>(data: PreparationPage<T>): PreparationPage<T> {
  if (!data || !Array.isArray(data.items) || data.items.length > 100 ||
      !Number.isSafeInteger(data.total) || data.total < 0 ||
      (data.nextCursor !== null && (typeof data.nextCursor !== 'string' || !data.nextCursor)) ||
      data.items.some((item) => !item || typeof item.id !== 'string' || !item.id) ||
      (data.nextCursor !== null && (data.items.length !== 100 || data.nextCursor !== data.items[data.items.length - 1].id))) {
    throw new Error('商談準備一覧の応答が正しくありません')
  }
  return data
}

export function appendPreparationPage<T extends { id: string }>(
  existing: T[], page: PreparationPage<T>, expectedTotal: number
): T[] {
  parsePreparationPage(page)
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

export function mergePreparationUpdates<T extends { id: string; status: string; updatedAt: string; targetName: string | null }>(existing: T[], updates: T[]): T[] {
  const byId = new Map(updates.map((item) => [item.id, item]))
  let changed = false
  const merged = existing.map((item) => {
    const update = byId.get(item.id)
    if (!update || (update.status === item.status && update.updatedAt === item.updatedAt && update.targetName === item.targetName)) return item
    changed = true
    return update
  })
  return changed ? merged : existing
}
