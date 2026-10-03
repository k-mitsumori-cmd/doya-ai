export type ScanCoverageCounts = {
  attempted: number
  succeeded: number
  failed: number
}

/** Older scans have no coverage record, so their completeness is unknown. */
export function scanCoverageCounts(summary: unknown): ScanCoverageCounts | null {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null
  const coverage = (summary as { coverage?: unknown }).coverage
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) return null
  const { attempted, succeeded, failed } = coverage as Partial<ScanCoverageCounts>
  if (![attempted, succeeded, failed].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) return null
  if (attempted === 0 || attempted !== succeeded! + failed!) return null
  return { attempted, succeeded: succeeded!, failed: failed! }
}

export function isCompleteScan(coverage: ScanCoverageCounts | null | undefined): boolean {
  return !!coverage && coverage.attempted > 0 && coverage.failed === 0 && coverage.succeeded === coverage.attempted
}
