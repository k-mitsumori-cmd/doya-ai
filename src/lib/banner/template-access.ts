export type BannerTemplateTier = 'FREE' | 'LIGHT' | 'PRO'

// Keep the gallery badge and generation API on the same stable template tier.
export function getBannerTemplateTier(templateId: string): BannerTemplateTier {
  let hash = 0
  for (let i = 0; i < templateId.length; i++) {
    hash = ((hash << 5) - hash) + templateId.charCodeAt(i)
    hash |= 0
  }
  const bucket = Math.abs(hash) % 100
  if (bucket < 50) return 'FREE'
  if (bucket < 75) return 'LIGHT'
  return 'PRO'
}

export function canUseBannerTemplate(plan: string, templateId: string): boolean {
  const normalized = plan.toUpperCase()
  if (['PRO', 'ENTERPRISE', 'BUNDLE', 'BASIC', 'STARTER', 'BUSINESS'].includes(normalized)) return true
  const tier = getBannerTemplateTier(templateId)
  if (normalized === 'LIGHT') return tier !== 'PRO'
  return tier === 'FREE'
}
