'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

/** Scope only the external marketing CTA containers, including widgets inserted after hydration. */
// Keep selector values as CSS identifiers: React 18 SSR escapes quotes inside style text.
export const SERVICE_POPUP_CSS = `
  #hs-web-interactives-top-anchor,
  [id^=hs-overlay-cta],
  iframe[src*=hs-web-interactive] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`

export default function ServicePopupGuard({ servicePaths }: { servicePaths: string[] }) {
  const pathname = usePathname()
  const { status } = useSession()
  const path = pathname?.replace(/\/+$/, '') || '/'
  const service = servicePaths.find(root => path === root || path.startsWith(root + '/'))
  const sharedMeeting = path.startsWith('/m/')
  if (!service && !sharedMeeting) return null

  const publicMarketing = service && (path === service || path === service + '/pricing' ||
    path === '/banner/landing' || path === '/banner/guide')
  // Authenticated service pages are work surfaces; pending auth must not flash an advertisement.
  if (status === 'unauthenticated' && publicMarketing) return null
  return <style data-service-popup-guard>{SERVICE_POPUP_CSS}</style>
}
