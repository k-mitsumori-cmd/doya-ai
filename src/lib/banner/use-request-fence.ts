'use client'

import { useEffect, useRef } from 'react'

/** One synchronous lane across chat, generation and refinement, scoped to the current session. */
export function useBannerRequestFence(status: string, actor: string) {
  const scope = JSON.stringify([status, actor])
  const epoch = useRef({ scope, revision: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, revision: epoch.current.revision + 1 }
  const key = JSON.stringify([scope, epoch.current.revision])
  const latest = useRef(key)
  latest.current = key
  const renderRevision = useRef(0)
  const renderedRevision = ++renderRevision.current
  const mounted = useRef(false)
  const pending = useRef<{ controller: AbortController; timer: number; key: string } | null>(null)
  const allowed = status === 'authenticated' && Boolean(actor)
  const active = () => mounted.current && latest.current === key
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const operation = pending.current
      if (operation) {
        window.clearTimeout(operation.timer)
        operation.controller.abort()
        pending.current = null
      }
    }
  }, [key])
  const begin = () => {
    if (!allowed || !active() || renderRevision.current !== renderedRevision || pending.current) return null
    const controller = new AbortController()
    const operation = { controller, timer: window.setTimeout(() => controller.abort(), 290_000), key }
    pending.current = operation
    return {
      signal: controller.signal,
      current: () => active() && pending.current === operation,
      finish: () => {
        window.clearTimeout(operation.timer)
        controller.abort()
        if (pending.current === operation) pending.current = null
      },
    }
  }
  return { allowed, active, begin }
}
