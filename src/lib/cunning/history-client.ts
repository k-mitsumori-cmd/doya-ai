export function mergeCunningEntries<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map(row => row.id))
  return [...existing, ...incoming.filter(row => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })]
}
