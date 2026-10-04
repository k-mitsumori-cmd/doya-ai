export type SeoLimitAction = { href: string; label: string } | null

export function seoLimitActionFromResponse(body: { upgradeUrl?: unknown; contactUrl?: unknown } | null | undefined): SeoLimitAction {
  if (typeof body?.upgradeUrl === 'string' && body.upgradeUrl.startsWith('/') && !body.upgradeUrl.startsWith('//')) {
    return { href: body.upgradeUrl, label: 'プランを見る' }
  }
  if (typeof body?.contactUrl === 'string' && /^https:\/\/[^\s/]+(?:\/|$)/.test(body.contactUrl)) {
    return { href: body.contactUrl, label: 'お問い合わせ' }
  }
  return null
}
