export type ApproachSummaryCounts = {
  allTotal: number
  thisMonth: number
  countsByType: Record<string, number>
}

export type ApproachPage<T> = {
  approaches: T[]
  total: number
  nextCursor: string | null
  summary: ApproachSummaryCounts
}

export function parseApproachPage<T extends { id: string }>(data: unknown): ApproachPage<T> {
  const page = data as ApproachPage<T> | null
  const summary = page?.summary
  if (!page || !Array.isArray(page.approaches) || page.approaches.length > 50 ||
      !Number.isSafeInteger(page.total) || page.total < 0 || page.approaches.length > page.total ||
      (page.approaches.length === 0 && page.total !== 0) ||
      page.approaches.some((row) => !row || typeof row.id !== 'string' || !row.id) ||
      (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor ||
        page.approaches.length !== 50 || page.nextCursor !== page.approaches[49].id)) ||
      !summary || !Number.isSafeInteger(summary.allTotal) || summary.allTotal < 0 ||
      !Number.isSafeInteger(summary.thisMonth) || summary.thisMonth < 0 || summary.thisMonth > summary.allTotal ||
      !summary.countsByType || typeof summary.countsByType !== 'object' || Array.isArray(summary.countsByType) ||
      Object.values(summary.countsByType).some((value) => !Number.isSafeInteger(value) || value < 0) ||
      Object.values(summary.countsByType).reduce((sum, value) => sum + value, 0) !== summary.allTotal ||
      page.total > summary.allTotal) {
    throw new Error('履歴の応答が正しくありません')
  }
  return page
}

export function appendApproachPage<T extends { id: string }>(existing: T[], page: ApproachPage<T>, expectedTotal: number): T[] {
  if (page.total !== expectedTotal) throw new Error('履歴が更新されました。再読み込みしてください')
  const ids = new Set(existing.map((row) => row.id))
  for (const row of page.approaches) {
    if (ids.has(row.id)) throw new Error('履歴が更新されました。再読み込みしてください')
    ids.add(row.id)
  }
  const merged = existing.concat(page.approaches)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('履歴を最後まで読み込めませんでした。再読み込みしてください')
  }
  return merged
}
