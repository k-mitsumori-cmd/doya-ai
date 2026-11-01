import type { ProductProfile, SuggestedItem } from './types'
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max
const integer = (value: unknown, min: number) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= 2147483647
export function isQuoteProductProfile(value: unknown): value is ProductProfile {
  if (!record(value)) return false
  for (const [field, max] of [['companyName',120],['summary',600],['deliveryModel',60],['pricingAxis',60],['targetCustomer',200]] as const) {
    if (value[field] !== undefined && !text(value[field], max)) return false
  }
  for (const field of ['publishedPrices','optionCandidates']) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].length > 20 || !value[field].every((item: unknown) => text(item,300)))) return false
  }
  return true
}
export function isQuoteSuggestedItem(value: unknown): value is SuggestedItem {
  if (!record(value) || !text(value.itemName,200) || !text(value.spec,1000) || !text(value.unit,12) || !text(value.sourceRef,1000)) return false
  if (!integer(value.qty,1) || value.unitPrice !== null && !integer(value.unitPrice,0) || ![8,10].includes(value.taxRate as number)) return false
  if (!['own_price','market','competitor','manual','ai_estimate','unknown'].includes(value.priceSource as string)) return false
  if (value.rangeMin !== null && !integer(value.rangeMin,0) || value.rangeMax !== null && !integer(value.rangeMax,0)) return false
  if (typeof value.rangeMin === 'number' && typeof value.rangeMax === 'number' && value.rangeMin > value.rangeMax) return false
  return true
}

/** Check echoed service fields; JSONB object key order is irrelevant. */
export function isQuoteProductAcknowledgement(value: unknown, submitted: { name: string; sourceUrl: string; profile: ProductProfile }) {
  if (!record(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.id)
      || value.name !== submitted.name.trim() || value.sourceUrl !== (submitted.sourceUrl.trim() || null)
      || !isQuoteProductProfile(value.profile)) return false
  for (const key of ['companyName', 'summary', 'deliveryModel', 'pricingAxis', 'targetCustomer', 'publishedPrices', 'optionCandidates'] as const) {
    if (JSON.stringify(value.profile[key]) !== JSON.stringify(submitted.profile[key])) return false
  }
  return true
}
