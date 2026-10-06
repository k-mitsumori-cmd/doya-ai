'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

/** Keep callbacks bound to their authenticated actor, organization and request generation. */
export function useOrgSettingsGuard(orgSlug: string) {
  const { data: session, status } = useSession()
  const lastActor = useRef('')
  const incoming = session?.user?.id || ''
  if (status === 'authenticated') lastActor.current = incoming
  if (status === 'unauthenticated') lastActor.current = ''
  const actor = status === 'unauthenticated' ? '' : status === 'loading' ? incoming || lastActor.current : incoming
  const identity = JSON.stringify([actor, orgSlug])
  const scope = JSON.stringify([identity, status])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const mounted = useRef(false)
  const denied = useRef('')
  const [deniedKey, setDeniedKey] = useState('')
  const operations = useRef(new Map<string, AbortController>())
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(orgSlug)
  useEffect(() => {
    mounted.current = true
    const pending = operations.current
    return () => {
      mounted.current = false
      for (const controller of pending.values()) controller.abort()
      pending.clear()
    }
  }, [key])
  const active = () => allowed && denied.current !== key && mounted.current && context.current === key
  const begin = (name: string) => {
    if (!active() || operations.current.has(name)) return null
    const controller = new AbortController()
    operations.current.set(name, controller)
    return {
      signal: controller.signal,
      current: () => active() && !controller.signal.aborted && operations.current.get(name) === controller,
      end: () => {
        if (operations.current.get(name) === controller) operations.current.delete(name)
        controller.abort()
      },
    }
  }
  const requiresLogin = status === 'unauthenticated' || status === 'authenticated' && (!actor || deniedKey === key)
  const rejectAuthentication = () => { if (context.current === key) { denied.current = key; setDeniedKey(key) } }
  return { identity, key, allowed, active, begin, requiresLogin, rejectAuthentication }
}
