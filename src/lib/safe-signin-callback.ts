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

// Only public service entry pages belong on the unauthenticated introduction link.
// The regression check compares this routing with the current public service catalog.
const PUBLIC_INTRO_SERVICES = new Set([
  'banner', 'seo', 'interview', 'persona', 'hr', 'kintai', 'doyalist', 'promane',
  'doyaslide', 'cunning', 'sfa', 'shodan', 'aio', 'mensetsu', 'quote', 'aishodan', 'adimage',
])

/** Do not advertise an authenticated dashboard, invitation, or private result as a guest trial. */
export function signInPublicIntroUrl(callbackUrl: string): string {
  const path = new URL(safeSignInCallbackUrl(callbackUrl), CALLBACK_BASE).pathname
  const serviceId = path.split('/')[1]
  if (!PUBLIC_INTRO_SERVICES.has(serviceId)) return '/'
  return serviceId === 'banner' ? '/banner/landing' : `/${serviceId}`
}

/** Invitations should let the person choose the account matching the recipient. */
export function invitationSignInOptions(callbackUrl: string): { prompt: 'select_account' } | undefined {
  const path = new URL(safeSignInCallbackUrl(callbackUrl), CALLBACK_BASE).pathname
  return /^\/(hr|aio|shodan|quote|mensetsu|aishodan|sfa|promane|kintai)\/invite\/[^/]+$/.test(path) ? { prompt: 'select_account' } : undefined
}
