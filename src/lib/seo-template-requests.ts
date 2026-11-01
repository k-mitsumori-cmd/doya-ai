'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

/** One title/create request at a time; old render callbacks cannot start new work. */
export function useSeoTemplateRequests(status: string, actor: string, planScope: string) {
  const scope = JSON.stringify([status, actor, planScope])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(key)
  latest.current = key
  const revision = useRef(0)
  const rendered = ++revision.current
  const committed = useRef(0)
  useLayoutEffect(() => { committed.current = rendered })
  const mounted = useRef(false)
  const pending = useRef<AbortController | null>(null)
  const allowed = status === 'authenticated' && Boolean(actor)
  const active = () => mounted.current && latest.current === key
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      pending.current?.abort()
      pending.current = null
    }
  }, [key])
  const begin = () => {
    if (!allowed || !active() || committed.current !== rendered || pending.current) return null
    const controller = new AbortController()
    pending.current = controller
    return {
      signal: controller.signal,
      current: () => active() && pending.current === controller,
      finish: () => {
        controller.abort()
        if (pending.current === controller) pending.current = null
      },
    }
  }
  return { key, active, allowed, begin }
}
