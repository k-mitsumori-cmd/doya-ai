export type ProjectSummaryCounts = {
  allTotal: number
  thisMonth: number
  totalCompanies: number
}

export type ProjectPage<T> = {
  projects: T[]
  total: number
  nextCursor: string | null
  summary: ProjectSummaryCounts
}

export function parseProjectPage<T extends { id: string }>(data: unknown): ProjectPage<T> {
  const page = data as ProjectPage<T> | null
  const summary = page?.summary
  if (!page || !Array.isArray(page.projects) || page.projects.length > 50 ||
      !Number.isSafeInteger(page.total) || page.total < 0 || page.projects.length > page.total ||
      (page.projects.length === 0 && page.total !== 0) ||
      page.projects.some((row) => !row || typeof row.id !== 'string' || !row.id) ||
      (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor ||
        page.projects.length !== 50 || page.nextCursor !== page.projects[49].id)) ||
      !summary || !Number.isSafeInteger(summary.allTotal) || summary.allTotal < page.total ||
      !Number.isSafeInteger(summary.thisMonth) || summary.thisMonth < 0 || summary.thisMonth > summary.allTotal ||
      !Number.isSafeInteger(summary.totalCompanies) || summary.totalCompanies < 0) {
    throw new Error('リスト履歴の応答が正しくありません')
  }
  return page
}

export function appendProjectPage<T extends { id: string }>(existing: T[], page: ProjectPage<T>, expectedTotal: number): T[] {
  if (page.total !== expectedTotal) throw new Error('リスト履歴が更新されました。再読み込みしてください')
  const ids = new Set(existing.map((row) => row.id))
  for (const row of page.projects) {
    if (ids.has(row.id)) throw new Error('リスト履歴が更新されました。再読み込みしてください')
    ids.add(row.id)
  }
  const merged = existing.concat(page.projects)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('リスト履歴を最後まで読み込めませんでした。再読み込みしてください')
  }
  return merged
}
