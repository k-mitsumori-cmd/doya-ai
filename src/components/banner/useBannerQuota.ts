'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

export type BannerQuota = { used: number; limit: number | null }
export type LimitPrompt = { open: boolean; used?: number; limit?: number; message?: string; upgradeUrl?: string }

export function parseBannerQuota(value: any): BannerQuota | null {
  const meter = value?.signedIn === true ? value?.summary?.meters?.[0] : null
  if (!meter || !Number.isFinite(meter.used) || meter.used < 0) return null
  if (meter.limit !== null && (!Number.isFinite(meter.limit) || meter.limit < 0)) return null
  return { used: meter.used, limit: meter.limit }
}

/** Usage is server-owned. No localStorage count or client-only trial changes the allowance. */
export function useBannerQuota(onLimit: (prompt: LimitPrompt) => void) {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; email?: string; plan?: string } | undefined
  const key = status === 'authenticated' ? `${user?.id || user?.email}:${user?.plan}` : ''
  const activeKey = useRef(key)
  activeKey.current = key
  const requestId = useRef(0)
  const checkingRef = useRef(false)
  const [checking, setChecking] = useState(false)
  const [snapshot, setSnapshot] = useState<{ key: string; usage: BannerQuota | null; error: boolean }>({ key: '', usage: null, error: false })
  const usage = snapshot.key === key && key ? snapshot.usage : null
  const error = snapshot.key === key && snapshot.error

  const refresh = useCallback(async (): Promise<BannerQuota | null> => {
    if (!key) return null
    const id = ++requestId.current
    try {
      const response = await fetch('/api/usage/banner', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const next = response.ok ? parseBannerQuota(await response.json()) : null
      if (activeKey.current !== key || id !== requestId.current) return null
      setSnapshot({ key, usage: next, error: !next })
      return next
    } catch {
      if (activeKey.current === key && id === requestId.current) setSnapshot({ key, usage: null, error: true })
      return null
    }
  }, [key])

  useEffect(() => {
    if (!key) return
    void refresh()
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(visible, 60000)
    return () => {
      requestId.current++
      window.clearInterval(timer)
      window.removeEventListener('focus', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [key, refresh])

  const acceptLimit = useCallback((data: any) => {
    const next = parseBannerQuota({ signedIn: true, summary: { meters: [{ used: data?.monthlyUsed, limit: data?.monthlyLimit === -1 ? null : data?.monthlyLimit }] } })
    if (next && key && activeKey.current === key) {
      requestId.current++
      setSnapshot({ key, usage: next, error: false })
    }
  }, [key])

  const showLimit = useCallback((next: BannerQuota) => onLimit({ open: true, used: next.used, limit: next.limit ?? undefined }), [onLimit])
  const check = async (count: number): Promise<boolean> => {
    if (status === 'loading' || checkingRef.current) return false
    // Guest policy remains enforced by each generation endpoint.
    if (!key) return true
    checkingRef.current = true
    setChecking(true)
    try {
      const next = await refresh()
      if (!next || activeKey.current !== key) return false
      if (next.limit !== null && next.used + count > next.limit) {
        showLimit(next)
        return false
      }
      return true
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }
  return { usage, error, checking, signedIn: !!key, refresh, acceptLimit, check, showLimit }
}
