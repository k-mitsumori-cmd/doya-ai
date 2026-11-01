'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { shouldHideMarketingPopup } from '@/lib/popup-visibility'

/** Scope only the external marketing CTA containers, including widgets inserted after hydration. */
// Keep selector values as CSS identifiers: React 18 SSR escapes quotes inside style text.
export const SERVICE_POPUP_CSS = `
  #hs-web-interactives-top-anchor,
  [id^=hs-overlay-cta],
  [class*=hs-interactives-modal],
  iframe[src*=hs-web-interactive] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`

/** 404 など、URL で決められない画面が自分で置く（決まりの外で、いつも隠す） */
export function ServicePopupHide() {
  return <style data-service-popup-guard>{SERVICE_POPUP_CSS}</style>
}

export default function ServicePopupGuard({ servicePaths }: { servicePaths: string[] }) {
  const pathname = usePathname()
  const { status } = useSession()
  if (!shouldHideMarketingPopup({ pathname, status, servicePaths })) return null
  return <style data-service-popup-guard>{SERVICE_POPUP_CSS}</style>
}
