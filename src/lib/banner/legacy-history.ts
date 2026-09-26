export function parseLegacyBannerBatchId(value: string): { start: Date; end: Date; keyword: string; size: string } | null {
  const separator = value.indexOf('|')
  const lastSeparator = value.lastIndexOf('|')
  if (separator !== 16 || lastSeparator <= separator) return null
  const minute = value.slice(0, separator)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(minute)) return null
  const start = new Date(`${minute}:00.000Z`)
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 16) !== minute) return null
  return { start, end: new Date(start.getTime() + 60_000 - 1), keyword: value.slice(separator + 1, lastSeparator), size: value.slice(lastSeparator + 1) }
}

export function matchesLegacyBannerBatch(row: { input: unknown; metadata: unknown }, keyword: string, size: string): boolean {
  const input = row.input && typeof row.input === 'object' && !Array.isArray(row.input) ? row.input as Record<string, unknown> : {}
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {}
  if (typeof metadata.batchId === 'string' && metadata.batchId) return false
  return String(input.keyword || metadata.keyword || '') === keyword && String(input.size || metadata.size || '') === size
}
