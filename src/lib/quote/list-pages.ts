export type QuoteListPage<T> = {
  rows: T[]
  nextCursor: string | null
  total: number
}

export function parseQuoteListPage<T extends { id: string }>(
  data: Record<string, unknown>, key: 'products' | 'documents', pageSize: number
): QuoteListPage<T> {
  const rows = data?.[key]
  const nextCursor = data?.nextCursor
  const total = data?.total
  if (!Array.isArray(rows) || rows.length > pageSize ||
      !Number.isSafeInteger(total) || (total as number) < 0 ||
      (nextCursor !== null && (typeof nextCursor !== 'string' || !nextCursor)) ||
      rows.some((row) => !row || typeof row.id !== 'string' || !row.id) ||
      (nextCursor !== null && (rows.length !== pageSize || nextCursor !== rows[rows.length - 1].id))) {
    throw new Error('組織の一覧データを確認できませんでした')
  }
  return { rows: rows as T[], nextCursor: nextCursor as string | null, total: total as number }
}

export function appendQuoteListPage<T extends { id: string }>(
  existing: T[], page: QuoteListPage<T>, expectedTotal: number
): T[] {
  if (page.total !== expectedTotal) throw new Error('一覧が更新されました。再読み込みしてください')
  const ids = new Set(existing.map((row) => row.id))
  for (const row of page.rows) {
    if (ids.has(row.id)) throw new Error('一覧が更新されました。再読み込みしてください')
    ids.add(row.id)
  }
  const merged = existing.concat(page.rows)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('一覧を最後まで読み込めませんでした。再読み込みしてください')
  }
  return merged
}
