'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBannerQuotaResponse } from '@/lib/banner-quota-response-client'

export type BannerQuota = { used: number; limit: number | null }
export type LimitPrompt = { open: boolean; used?: number; limit?: number; message?: string; upgradeUrl?: string }

export function parseBannerQuota(value: any): BannerQuota | null {
  const meters = value?.signedIn === true ? value?.summary?.meters : null
  const meter = Array.isArray(meters) && meters.length === 1 ? meters[0] : null
  if (!meter || meter.label !== '今月' || !Number.isSafeInteger(meter.used) || meter.used < 0) return null
  if (meter.limit !== null && (!Number.isSafeInteger(meter.limit) || meter.limit < 0)) return null
  return { used: meter.used, limit: meter.limit }
}

/** Usage is server-owned. No localStorage count or client-only trial changes the allowance. */
export function useBannerQuota(onLimit: (prompt: LimitPrompt) => void) {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; email?: string; plan?: string } | undefined
  const actor = user?.id || user?.email || ''
  const signedIn = status === 'authenticated'
  const allowed = signedIn && Boolean(actor)
  const scope = JSON.stringify([status, actor, user?.plan, (session?.user as any)?.bannerPlan])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const activeKey = useRef(key)
  activeKey.current = key
  const requestId = useRef(0)
  const checkingRef = useRef<{ key: string } | null>(null)
  const [checkingKey, setCheckingKey] = useState<string | null>(null)
  const checking = allowed && checkingKey === key
  const pending = useRef<{ key: string; controller: AbortController; task: Promise<BannerQuota | null> } | null>(null)
  const [snapshot, setSnapshot] = useState<{ key: string; usage: BannerQuota | null; error: boolean }>({ key: '', usage: null, error: false })
  const usage = allowed && snapshot.key === key ? snapshot.usage : null
  const error = signedIn && (!allowed || (snapshot.key === key && snapshot.error))

  const refresh = useCallback((): Promise<BannerQuota | null> => {
    if (!mounted.current || !allowed || activeKey.current !== key) return Promise.resolve(null)
    if (pending.current?.key === key) return pending.current.task
    pending.current?.controller.abort()
    const controller = new AbortController()
    const id = ++requestId.current
    const current = () => mounted.current && activeKey.current === key && id === requestId.current && !controller.signal.aborted
    const task = Promise.resolve().then(async () => {
      if (!current()) return null
      try {
        const next = parseBannerQuota(await readBannerQuotaResponse(controller.signal))
        if (!current()) return null
        setSnapshot({ key, usage: next, error: !next })
        if (next) window.dispatchEvent(new window.CustomEvent('banner:usage-changed', { detail: { actor } }))
        return next
      } catch {
        if (current()) setSnapshot({ key, usage: null, error: true })
        return null
      } finally {
        if (pending.current?.controller === controller) pending.current = null
        controller.abort()
      }
    })
    pending.current = { key, controller, task }
    return task
  }, [key, allowed, actor])

  useEffect(() => {
    if (!allowed) return
    void refresh()
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(visible, 60000)
    return () => {
      requestId.current++
      if (pending.current?.key === key) { pending.current.controller.abort(); pending.current = null }
      if (checkingRef.current?.key === key) checkingRef.current = null
      window.clearInterval(timer)
      window.removeEventListener('focus', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [key, allowed, refresh])

  const acceptLimit = useCallback((data: any) => {
    const next = parseBannerQuota({ signedIn: true, summary: { meters: [{ label: '今月', used: data?.monthlyUsed, limit: data?.monthlyLimit === -1 ? null : data?.monthlyLimit }] } })
    if (mounted.current && next && allowed && activeKey.current === key) {
      requestId.current++
      if (pending.current?.key === key) { pending.current.controller.abort(); pending.current = null }
      setSnapshot({ key, usage: next, error: false })
      window.dispatchEvent(new window.CustomEvent('banner:usage-changed', { detail: { actor } }))
    }
  }, [key, allowed, actor])

  const reportLimit = useCallback((data: any) => {
    // API handlers can outlive a session/plan. A raw parent setter cannot
    // distinguish a current response from one belonging to an earlier scope.
    if (!mounted.current || !allowed || activeKey.current !== key) return false
    acceptLimit(data?.usage)
    const used = data?.usage?.monthlyUsed
    const limit = data?.usage?.monthlyLimit
    onLimit({
      open: true,
      used: Number.isSafeInteger(used) && used >= 0 ? used : undefined,
      limit: Number.isSafeInteger(limit) && limit >= 0 ? limit : undefined,
      message: typeof data?.error === 'string' ? data.error : undefined,
      upgradeUrl: typeof data?.upgradeUrl === 'string' ? data.upgradeUrl : undefined,
    })
    return true
  }, [key, allowed, acceptLimit, onLimit])

  const showLimit = useCallback((next: BannerQuota) => {
    if (mounted.current && activeKey.current === key) onLimit({ open: true, used: next.used, limit: next.limit ?? undefined })
  }, [key, onLimit])
  const check = async (count: number): Promise<boolean> => {
    if (!mounted.current || !Number.isSafeInteger(count) || count <= 0 || activeKey.current !== key || status === 'loading' || checkingRef.current?.key === key) return false
    // Guest policy remains enforced by each generation endpoint.
    if (status === 'unauthenticated') return true
    if (!allowed) return false
    const lock = { key }
    checkingRef.current = lock
    setCheckingKey(key)
    try {
      const next = await refresh()
      if (!next || activeKey.current !== key) return false
      if (next.limit !== null && count > next.limit - next.used) {
        showLimit(next)
        return false
      }
      return true
    } finally {
      if (checkingRef.current === lock) {
        checkingRef.current = null
        setCheckingKey(null)
      }
    }
  }
  return { usage, error, checking, signedIn, refresh, acceptLimit, reportLimit, check, showLimit }
}
