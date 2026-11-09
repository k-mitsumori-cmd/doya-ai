export type CompanyMemberUsage = { used: number; limit: number; kind: 'none' | 'legacy' | 'team' }

/** The list may omit tool-only users. Never treat unknown capacity as zero. */
export function parseCompanyMemberUsage(value: unknown): CompanyMemberUsage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.seatUsageUnavailable !== false || typeof row.kind !== 'string' || !['none', 'legacy', 'team'].includes(row.kind)) return null
  const { used, limit } = row
  if (typeof used !== 'number' || !Number.isSafeInteger(used) || used < 1 ||
      typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > 49) return null
  if ((row.kind === 'legacy' && limit !== 1) || (row.kind === 'none' && limit > 3)) return null
  return { used, limit, kind: row.kind as CompanyMemberUsage['kind'] }
}
