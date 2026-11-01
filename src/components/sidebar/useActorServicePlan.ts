'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { readBillingResponse } from '@/lib/billing-response-client'

/** Metadata reads never authorize server mutations. Keep drafts scoped separately from plan refreshes. */
export function useActorServicePlan(service: 'doyaslide' | 'cunning', enabled = true) {
  const { data: session, status } = useSession()
  const pathname = usePathname() || ''
  const actor = status === 'unauthenticated' ? '' : session?.user?.id || ''
  const identity = useRef({ actor, version: 0, hasActor: Boolean(actor) })
  if (identity.current.actor !== actor) identity.current = {
    actor, version: identity.current.version + (identity.current.hasActor ? 1 : 0),
    hasActor: identity.current.hasActor || Boolean(actor),
  }
  const actorKey = JSON.stringify([actor, identity.current.version])
  const authenticated = useRef('')
  if (status === 'authenticated' && actor) authenticated.current = actorKey
  const knownActor = Boolean(actor) && authenticated.current === actorKey
  const allowed = enabled && status === 'authenticated' && Boolean(actor)
  const scope = JSON.stringify([service, actorKey, status, (session?.user as { plan?: string } | undefined)?.plan, pathname, enabled])
  const scopeEpoch = useRef({ scope, version: 0 })
  if (scopeEpoch.current.scope !== scope) scopeEpoch.current = { scope, version: scopeEpoch.current.version + 1 }
  const key = JSON.stringify([scope, scopeEpoch.current.version])
  const context = useRef(key)
  context.current = key
  const [snapshot, setSnapshot] = useState<{ key: string; plan?: string; failed: boolean } | null>(null)
  const load = useRef<() => void>(() => {})
  const refresh = useCallback(() => load.current(), [])
  useEffect(() => {
    if (!allowed) { load.current = () => {}; return }
    let alive = true
    let pending: AbortController | null = null
    const read = () => {
      if (!alive || context.current !== key || pending) return
      const controller = new AbortController()
      pending = controller
      const current = () => alive && context.current === key && !controller.signal.aborted
      setSnapshot({ key, failed: false })
      void Promise.resolve().then(async () => {
        if (!current()) return
        try {
          const response = await readBillingResponse(`/api/${service}/usage`, { method: 'GET' }, controller.signal)
          if (!current()) return
          const plan = response.data.plan
          const valid = response.ok && response.data.error === undefined && response.data.code === undefined &&
            typeof plan === 'string' && ['GUEST', 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE'].includes(plan) &&
            (response.data.tier === undefined || response.data.tier === plan)
          setSnapshot({ key, plan: valid ? plan as string : undefined, failed: !valid })
        } catch {
          if (current()) setSnapshot({ key, failed: true })
        } finally {
          if (pending === controller) pending = null
          controller.abort()
        }
      })
    }
    load.current = read
    read()
    window.addEventListener('focus', read)
    return () => { alive = false; pending?.abort(); window.removeEventListener('focus', read) }
  }, [allowed, key, service])
  const current = allowed && snapshot?.key === key ? snapshot : null
  return { actorKey: identity.current.version, actor, status, knownActor, plan: current?.plan, failed: current?.failed || false, refresh }
}
