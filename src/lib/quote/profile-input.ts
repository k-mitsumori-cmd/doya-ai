import type { ProductProfile } from './types'

/** Keep client and stored profile data within the fields and sizes used in AI prompts. */
export function sanitizeProductProfile(value: unknown): ProductProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const text = (field: string, max: number): string | undefined =>
    typeof input[field] === 'string' ? (input[field] as string).trim().slice(0, max) || undefined : undefined
  const list = (field: string): string[] | undefined =>
    Array.isArray(input[field])
      ? (input[field] as unknown[]).filter((item): item is string => typeof item === 'string')
          .slice(0, 20).map(item => item.trim().slice(0, 300)).filter(Boolean)
      : undefined
  return {
    companyName: text('companyName', 120),
    summary: text('summary', 600),
    deliveryModel: text('deliveryModel', 60),
    pricingAxis: text('pricingAxis', 60),
    targetCustomer: text('targetCustomer', 200),
    publishedPrices: list('publishedPrices'),
    optionCandidates: list('optionCandidates'),
  }
}
