export interface SfaSummary {
  totalCount: number
  openCount: number
  staleCount: number
  openTaskCount: number
  openTotal: string
  weighted: string
  wonTotal: string
}

export function isSfaSummary(value: unknown): value is SfaSummary {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['totalCount', 'openCount', 'staleCount', 'openTaskCount'].every(k => Number.isSafeInteger(v[k]) && (v[k] as number) >= 0)
    && ['openTotal', 'weighted', 'wonTotal'].every(k => typeof v[k] === 'string' && /^-?\d+$/.test(v[k] as string))
}

export function summaryYen(amount: string): string {
  return '¥' + BigInt(amount).toLocaleString('ja-JP')
}
