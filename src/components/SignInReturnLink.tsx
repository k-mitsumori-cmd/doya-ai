'use client'

import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { safeSignInCallbackUrl } from '@/lib/safe-signin-callback'

function signInHref(path: string | null, fallback: string) {
  const safe = safeSignInCallbackUrl(path)
  const destination = safe === '/home' && path !== '/home' ? safeSignInCallbackUrl(fallback) : safe
  return `/auth/signin?callbackUrl=${encodeURIComponent(destination)}`
}

export default function SignInReturnLink({ children, fallback, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { children: ReactNode; fallback: string }) {
  const pathname = usePathname()
  const [href, setHref] = useState(() => signInHref(pathname, fallback))
  const refreshTarget = (target: HTMLAnchorElement) => {
    // replaceState can change only the query without a React route change.
    target.href = signInHref(`${window.location.pathname}${window.location.search}${window.location.hash}`, fallback)
  }

  useEffect(() => {
    const refresh = () => setHref(signInHref(`${window.location.pathname}${window.location.search}${window.location.hash}`, fallback))
    refresh()
    window.addEventListener('popstate', refresh)
    window.addEventListener('hashchange', refresh)
    return () => {
      window.removeEventListener('popstate', refresh)
      window.removeEventListener('hashchange', refresh)
    }
  }, [pathname, fallback])

  return <a {...props} href={href} onPointerDown={event => {
    refreshTarget(event.currentTarget)
    props.onPointerDown?.(event)
  }} onFocus={event => {
    refreshTarget(event.currentTarget)
    props.onFocus?.(event)
  }} onContextMenu={event => {
    refreshTarget(event.currentTarget)
    props.onContextMenu?.(event)
  }} onAuxClick={event => {
    refreshTarget(event.currentTarget)
    props.onAuxClick?.(event)
  }} onClick={event => {
    refreshTarget(event.currentTarget)
    props.onClick?.(event)
  }}>{children}</a>
}
