import type { CompanyResearch } from './types'

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown) => typeof v === 'string' && v.length <= 100_000
const list = (v: unknown) => Array.isArray(v) && v.length <= 500 && v.every(text)
const web = (v: unknown) => {
  if (typeof v !== 'string' || v.length > 8192) return false
  try { const url = new URL(v); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
/** Validate every required research field before any screen consumes the result. */
export function isCompanyResearch(v: unknown): v is CompanyResearch {
  if (!record(v) || !web(v.url) || !record(v.marketing) || !record(v.ownedMedia)) return false
  const m = v.marketing, o = v.ownedMedia
  if (!list(m.snsChannels) || !list(m.martechTools) || !text(m.summary) || ['hasContactForm', 'hasLeadMagnet', 'runsAds'].some(k => typeof m[k] !== 'boolean')) return false
  if (typeof o.hasOwnedMedia !== 'boolean' || !Array.isArray(o.mediaUrls) || o.mediaUrls.length > 500 || !o.mediaUrls.every(web)
    || typeof o.articleCountEstimate !== 'number' || !Number.isFinite(o.articleCountEstimate) || o.articleCountEstimate < 0
    || !['high', 'medium', 'low', 'inactive', 'unknown'].includes(o.updateFrequency as string) || !text(o.frequencyNote)
    || !['large', 'medium', 'small', 'unknown'].includes(o.siteScale as string)) return false
  for (const k of ['companyName', 'corporateNumber', 'capital', 'industry', 'foundedYear', 'address', 'representative', 'description', 'rawNotes']) if (v[k] != null && !text(v[k])) return false
  if (v.employeeCount != null && (typeof v.employeeCount !== 'number' || !Number.isSafeInteger(v.employeeCount) || v.employeeCount < 0)) return false
  if (v.employeeCountSource != null && !['gbizinfo', 'website', 'estimate', 'unknown'].includes(v.employeeCountSource as string)) return false
  if (v.services != null && !list(v.services) || v.ogImage != null && !web(v.ogImage)) return false
  if (v.crawledUrls != null && (!Array.isArray(v.crawledUrls) || v.crawledUrls.length > 500 || !v.crawledUrls.every(web))) return false
  if (o.latestArticleDate != null && !text(o.latestArticleDate)) return false
  if (v.sourceStatus !== undefined && (!record(v.sourceStatus) || !['ok', 'failed'].includes(v.sourceStatus.homepage as string) || ['gbizinfo', 'prtimes'].some(k => !['ok', 'failed', 'skipped'].includes((v.sourceStatus as Record<string, unknown>)[k] as string)))) return false
  if (v.pressReleases != null && (!Array.isArray(v.pressReleases) || v.pressReleases.length > 500 || v.pressReleases.some(p => !record(p) || !text(p.title) || !web(p.url) || p.date != null && !text(p.date) || p.image != null && !web(p.image) || p.source != null && !text(p.source)))) return false
  return true
}
