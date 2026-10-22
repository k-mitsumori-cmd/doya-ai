import type { RunDto } from './dto'

type RecordValue = Record<string, unknown>
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
const oneOf = (value: unknown, options: string[]) => typeof value === 'string' && options.includes(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const sourceId = (value: unknown) => value === undefined || value === null || typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
function webUrl(value: unknown, httpsOnly = false): value is string {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return !url.username && !url.password && (url.protocol === 'https:' || !httpsOnly && url.protocol === 'http:') } catch { return false }
}

/** Confirm the fields consumed by the full result UI before replacing a saved result. */
export function parseAskLinkCreationRunResponse(value: unknown, expectedId: string): RunDto {
  const invalid = () => Error('保存結果の内容を確認できませんでした。再生成せず、結果を再取得してください。')
  if (!record(value) || value.error !== undefined || value.code !== undefined || !record(value.run)) throw invalid()
  const run = value.run, site = run.site
  if (!sourceId(run.bannerSourceId)) throw invalid()
  if (run.id !== expectedId || !webUrl(run.sourceUrl) || !oneOf(run.source, ['site', 'manual']) || !oneOf(run.audience, ['b2b', 'b2c']) || !oneOf(run.detectedAudience, ['b2b', 'b2c']) || !date(run.createdAt) || !record(site)) throw invalid()
  if (!['name', 'summary', 'target'].every(key => typeof site[key] === 'string') || !strings(site.strengths) || !strings(site.colors) || !Array.isArray(site.pages) || !site.pages.every(page => record(page) && typeof page.label === 'string' && webUrl(page.url)) || !['contactUrl', 'downloadUrl', 'pricingUrl'].every(key => site[key] == null || webUrl(site[key]))) throw invalid()
  if (!strings(run.allowedUrls) || !run.allowedUrls.every(url => webUrl(url)) || !Array.isArray(run.links) || run.links.length !== 2) throw invalid()
  const keys = new Set<string>()
  for (const link of run.links) {
    if (!record(link) || typeof link.key !== 'string' || !['understand', 'prepare', 'choose', 'reassure', 'pages'].includes(link.key) || keys.has(link.key) || !['title', 'buttonLabel', 'question'].every(key => typeof link[key] === 'string') || !webUrl(link.url) || typeof link.needsReview !== 'boolean' || !record(link.check) || typeof link.check.ok !== 'boolean' || !count(link.check.chars) || !count(link.check.urlLength) || !strings(link.check.issues)) throw invalid()
    keys.add(link.key)
  }
  if (run.bannerCopy !== null && (!record(run.bannerCopy) || typeof run.bannerCopy.headline !== 'string' || typeof run.bannerCopy.sub !== 'string' || !strings(run.bannerCopy.bubbles) || run.bannerCopy.bubbles.length !== 3)) throw invalid()
  if (!Array.isArray(run.banners) || run.banners.length !== 3) throw invalid()
  const kinds = new Set<string>()
  for (const banner of run.banners) {
    if (!record(banner) || !sourceId(banner.sourceId)) throw invalid()
    if (!record(banner) || typeof banner.kind !== 'string' || !['landscape', 'square', 'portrait'].includes(banner.kind) || kinds.has(banner.kind) || typeof banner.label !== 'string' || typeof banner.use !== 'string' || !count(banner.w) || banner.w === 0 || !count(banner.h) || banner.h === 0 || !oneOf(banner.status, ['none', 'pending', 'generating', 'done', 'failed']) || !count(banner.remaining) || banner.remaining > 2 || !(banner.url === null || webUrl(banner.url, true))) throw invalid()
    if (banner.verify !== null && (!record(banner.verify) || typeof banner.verify.ok !== 'boolean' || typeof banner.verify.needsReview !== 'boolean' || !strings(banner.verify.missing) || !(banner.verify.detectedText === undefined || typeof banner.verify.detectedText === 'string'))) throw invalid()
    kinds.add(banner.kind)
  }
  return run as unknown as RunDto
}
