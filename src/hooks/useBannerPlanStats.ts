'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'

type Stats = { totalBanners: number; monthlyUsage: number; monthlyLimit: number }

/** Read-only statistics cannot survive an actor or entitlement transition. */
export function useBannerPlanStats() {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; plan?: string; bannerPlan?: string } | undefined
  const allowed = status === 'authenticated' && Boolean(user?.id)
  const scope = JSON.stringify([status, user?.id, user?.plan, user?.bannerPlan])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const [snapshot, setSnapshot] = useState<{ key: string; data: Stats | null; error: boolean } | null>(null)
  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    const controller = new AbortController()
    const current = () => !cancelled && context.current === key && !controller.signal.aborted
    void Promise.resolve().then(async () => {
      if (!current()) return
      try {
        const response = await readBillingResponse('/api/banner/stats', { method: 'GET' }, controller.signal)
        if (!current()) return
        const data = response.data
        if (!response.ok || !Number.isSafeInteger(data.totalBanners) || (data.totalBanners as number) < 0 ||
          !Number.isSafeInteger(data.monthlyUsage) || (data.monthlyUsage as number) < 0 ||
          !Number.isSafeInteger(data.monthlyLimit) || (data.monthlyLimit as number) < -1) throw new Error('Statistics unavailable')
        setSnapshot({ key, data: data as Stats, error: false })
      } catch {
        if (current()) setSnapshot({ key, data: null, error: true })
      } finally { controller.abort() }
    })
    return () => { cancelled = true; controller.abort() }
  }, [allowed, key])
  // Guest image generation is disabled; no account history is inferred from legacy storage.
  const data = status === 'unauthenticated' ? { totalBanners: 0, monthlyUsage: 0, monthlyLimit: 0 }
    : allowed && snapshot?.key === key ? snapshot.data : null
  return { data, error: status === 'authenticated' && (!allowed || (snapshot?.key === key && snapshot.error)) }
}
