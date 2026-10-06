/** Registration eligibility uses the account creation timestamp, never a repaired login stamp. */
export function isRecentRegistration(createdAt: unknown, now = Date.now()): boolean {
  if (typeof createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) || !Number.isFinite(now)) return false
  const timestamp = Date.parse(createdAt)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) return false
  const age = now - timestamp
  return age >= 0 && age < 30 * 60 * 1000
}
