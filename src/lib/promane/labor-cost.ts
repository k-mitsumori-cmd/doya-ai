type CostEntry = { duration: number; hourlyRateSnapshot?: number | null }

function nonNegative(value: number | null | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : Math.max(0, value)
}

export function laborCostForEntry(entry: CostEntry, currentHourlyRate: number): number {
  return nonNegative(entry.duration) / 60 * nonNegative(entry.hourlyRateSnapshot ?? currentHourlyRate)
}
