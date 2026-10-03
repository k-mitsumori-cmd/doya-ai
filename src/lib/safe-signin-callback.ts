const CALLBACK_BASE = 'https://doya-signin.invalid'

/** Keep sign-in return destinations on this site, including guest navigation links. */
export function safeSignInCallbackUrl(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.includes('\\')) return '/seo'
  try {
    const url = new URL(raw, CALLBACK_BASE)
    if (url.origin !== CALLBACK_BASE) return '/seo'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/seo'
  }
}
