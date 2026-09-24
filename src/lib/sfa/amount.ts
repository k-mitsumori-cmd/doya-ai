/** 円単位の金額を、DB の BigInt に安全に変換する。 */
export function parseSfaAmount(value: unknown): bigint | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) return null
  const rounded = Math.round(amount)
  if (!Number.isSafeInteger(rounded)) return null
  return BigInt(rounded)
}
