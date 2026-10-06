'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { readBillingResponse } from '@/lib/billing-response-client'

export type ApproachUsage = { tier: string; used: number; limit: number; remaining: number }

export function parseApproachUsage(value: unknown): ApproachUsage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, any>
  const tier = data.plan?.tier
  const used = data.usage?.approachesGenerated
  const limit = data.limits?.maxApproachesPerMonth
  const remaining = data.remaining?.approaches
  if (data.success !== true || data.error !== undefined || data.code !== undefined ||
    typeof tier !== 'string' || !['GUEST', 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE'].includes(tier) ||
    !Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(limit) || limit < -1 ||
    !Number.isSafeInteger(remaining) || remaining !== (limit === -1 ? -1 : Math.max(0, limit - used))) return null
  return { tier, used, limit, remaining }
}

/** The server ledger includes approach reservations before provider generation starts. */
export function useApproachUsage(toolType: string) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const user = session?.user as { id?: string; plan?: string } | undefined
  const allowed = status === 'authenticated' && Boolean(user?.id)
  const scope = JSON.stringify([status, user?.id, user?.plan, toolType, pathname])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const [snapshot, setSnapshot] = useState<{ key: string; usage: ApproachUsage | null; failed: boolean } | null>(null)
  const load = useRef<() => void>(() => {})
  const refresh = useCallback(() => load.current(), [])
  useEffect(() => {
    if (!allowed) { load.current = () => {}; return }
    let alive = true
    let pending: AbortController | null = null
    let refreshQueued = false
    const read = () => {
      if (!alive || context.current !== key || pending) return
      const controller = new AbortController()
      pending = controller
      const current = () => alive && context.current === key && !controller.signal.aborted
      setSnapshot({ key, usage: null, failed: false })
      void Promise.resolve().then(async () => {
        if (!current()) return
        try {
          const response = await readBillingResponse('/api/doyalist/usage', { method: 'GET' }, controller.signal)
          if (!current()) return
          const usage = response.ok ? parseApproachUsage(response.data) : null
          if (!refreshQueued) setSnapshot({ key, usage, failed: !usage })
        } catch {
          if (current() && !refreshQueued) setSnapshot({ key, usage: null, failed: true })
        } finally {
          if (pending === controller) pending = null
          controller.abort()
          if (refreshQueued && alive && context.current === key) { refreshQueued = false; read() }
        }
      })
    }
    load.current = () => { if (pending) refreshQueued = true; else read() }
    read()
    const interval = window.setInterval(read, 60000)
    window.addEventListener('focus', read)
    return () => { alive = false; pending?.abort(); window.clearInterval(interval); window.removeEventListener('focus', read) }
  }, [allowed, key])
  const usage = allowed && snapshot?.key === key ? snapshot.usage : null
  return { key, status, actor: status === 'unauthenticated' ? '' : user?.id || '', allowed, usage, failed: status === 'authenticated' && (!allowed || (snapshot?.key === key && snapshot.failed)), refresh }
}
