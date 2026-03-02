// ============================================
// ドヤオープニングAI - 利用制限
// ============================================

export function getOpeningDailyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.OPENING_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'BUNDLE') return 30
  if (p === 'ENTERPRISE') return 30
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return 30
  return 3
}

export const OPENING_GUEST_LIMIT = 2

export const OPENING_FREE_TEMPLATES = ['elegant-fade', 'dynamic-split', 'cinematic-reveal']
export const OPENING_PRO_TEMPLATES = ['particle-burst', 'corporate-slide', 'luxury-morph']

export function isProTemplate(templateId: string): boolean {
  return OPENING_PRO_TEMPLATES.includes(templateId)
}
