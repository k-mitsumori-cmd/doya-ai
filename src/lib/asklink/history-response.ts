export interface AskLinkHistoryRow {
  id: string
  sourceUrl: string
  audience: 'b2b' | 'b2c'
  name: string
  bannersDone: number
  createdAt: string
}

/** A malformed success response is not an empty history. */
export function parseAskLinkHistory(value: unknown): AskLinkHistoryRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid history response')
  const runs = (value as { runs?: unknown }).runs
  if (!Array.isArray(runs)) throw new Error('Invalid history response')
  const ids = new Set<string>()
  return runs.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid history response')
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string' || !/^c[a-z0-9]{24}$/.test(row.id) || ids.has(row.id)
      || typeof row.sourceUrl !== 'string' || !row.sourceUrl.trim()
      || (row.audience !== 'b2b' && row.audience !== 'b2c')
      || typeof row.name !== 'string' || !row.name.trim()
      || typeof row.bannersDone !== 'number' || !Number.isInteger(row.bannersDone) || row.bannersDone < 0 || row.bannersDone > 3
      || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) {
      throw new Error('Invalid history response')
    }
    ids.add(row.id)
    return { id: row.id, sourceUrl: row.sourceUrl, audience: row.audience, name: row.name, bannersDone: row.bannersDone, createdAt: row.createdAt }
  })
}
