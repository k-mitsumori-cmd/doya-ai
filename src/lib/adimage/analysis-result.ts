import { APPEAL_LABELS, COPY_LIMITS, type BrandProfile, type ConceptDraft } from './types'

export interface AdImageAnalysisOutput {
  brand: BrandProfile
  concepts: Array<ConceptDraft & { warnings: string[] }>
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0)
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(k => allowed.includes(k))
const strings = (value: unknown, count: number, max: number): value is string[] => Array.isArray(value) && value.length <= count && value.every(v => text(v, max))
const publicUrl = (value: unknown) => {
  if (!text(value, 8192)) return false
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}

/** Shared server/response boundary: never coerce objects into user-visible copy.
 * Kept independent of providers/storage so saved receipts and browser recovery
 * validate the same bounded result without a second model invocation.
 */
export function validAdImageAnalysisOutput(value: unknown): value is AdImageAnalysisOutput {
  if (!record(value) || !keys(value, ['brand', 'concepts']) || !record(value.brand)) return false
  const brand = value.brand
  if (!keys(brand, ['name', 'description', 'valueProps', 'colors', 'industry', 'tone', 'logoUrl']) || !text(brand.name, 120)
    || !strings(brand.valueProps, 8, 500) || !Array.isArray(brand.colors) || !brand.colors.length || brand.colors.length > 5
    || brand.colors.some(v => typeof v !== 'string' || !/^#[a-f0-9]{6}$/i.test(v))
    || (brand.description !== undefined && !text(brand.description, 500))
    || (brand.industry !== undefined && !text(brand.industry, 60))
    || (brand.tone !== undefined && !text(brand.tone, 120))
    || (brand.logoUrl !== undefined && !publicUrl(brand.logoUrl))) return false
  if (!Array.isArray(value.concepts) || value.concepts.length < 1 || value.concepts.length > 4) return false
  const validDrafts = value.concepts.every(d => record(d) && keys(d, ['label', 'appealAxis', 'tone', 'copy', 'warnings'])
    && text(d.label, 120) && typeof d.appealAxis === 'string' && Object.prototype.hasOwnProperty.call(APPEAL_LABELS, d.appealAxis)
    && text(d.tone, 120) && record(d.copy) && keys(d.copy, ['headline', 'sub', 'cta'])
    && text(d.copy.headline, COPY_LIMITS.headline) && text(d.copy.sub, COPY_LIMITS.sub, true) && text(d.copy.cta, COPY_LIMITS.cta)
    && strings(d.warnings, 10, 500))
  return validDrafts && new TextEncoder().encode(JSON.stringify(value)).byteLength <= 48 * 1024
}
