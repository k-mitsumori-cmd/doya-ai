export function parseRoomMaxSessions(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null
  const count = Number(value)
  return Number.isInteger(count) && count >= 1 && count <= 5000 ? count : null
}

// undefined means invalid; null explicitly removes the expiry.
export function parseRoomExpiryDays(value: unknown): Date | null | undefined {
  if (value === null || value === 0 || value === '0') return null
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return undefined
  const days = Number(value)
  if (!Number.isSafeInteger(days) || days < 1) return undefined
  const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return Number.isFinite(expiry.getTime()) ? expiry : undefined
}
