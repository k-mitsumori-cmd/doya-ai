export type CunningProfilePage<T> = { profiles: T[]; total: number; nextCursor: string | null }

export function parseCunningProfilePage<T extends { id: string }>(data: unknown): CunningProfilePage<T> {
  const page = data as CunningProfilePage<T> | null
  if (!page || !Array.isArray(page.profiles) || page.profiles.length > 50 ||
      !Number.isSafeInteger(page.total) || page.total < 0 || page.profiles.length > page.total ||
      (page.profiles.length === 0 && page.total !== 0) ||
      page.profiles.some((row) => !row || typeof row.id !== 'string' || !row.id) ||
      (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor ||
        page.profiles.length !== 50 || page.nextCursor !== page.profiles[49].id))) {
    throw new Error('プロフィール一覧の応答が正しくありません')
  }
  return page
}

export function appendCunningProfilePage<T extends { id: string }>(
  existing: T[], page: CunningProfilePage<T>, expectedTotal: number
): T[] {
  if (page.total !== expectedTotal) throw new Error('一覧が更新されました。再読み込みしてください')
  const ids = new Set(existing.map((row) => row.id))
  for (const row of page.profiles) {
    if (ids.has(row.id)) throw new Error('一覧が更新されました。再読み込みしてください')
    ids.add(row.id)
  }
  const merged = existing.concat(page.profiles)
  if (merged.length > expectedTotal || (page.nextCursor === null && merged.length !== expectedTotal)) {
    throw new Error('一覧を最後まで読み込めませんでした。再読み込みしてください')
  }
  return merged
}
