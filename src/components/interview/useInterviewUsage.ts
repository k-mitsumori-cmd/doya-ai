'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { readBillingResponse } from '@/lib/billing-response-client'

type Usage = { usedMinutes: number; reservedMinutes: number; limitMinutes: number }

export function parseInterviewUsage(value: unknown): Usage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (data.success !== true || data.error !== undefined || data.code !== undefined ||
    !Number.isSafeInteger(data.usedMinutes) || (data.usedMinutes as number) < 0 ||
    !Number.isSafeInteger(data.reservedMinutes) || (data.reservedMinutes as number) < 0 ||
    !Number.isSafeInteger(data.limitMinutes) || (data.limitMinutes as number) < -1) return null
  return { usedMinutes: data.usedMinutes as number, reservedMinutes: data.reservedMinutes as number, limitMinutes: data.limitMinutes as number }
}

/** Read-only usage is private and includes capacity reserved by in-flight transcription. */
export function useInterviewUsage() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const user = session?.user as { id?: string; plan?: string; interviewPlan?: string } | undefined
  const allowed = status === 'authenticated' && Boolean(user?.id)
  const scope = JSON.stringify([status, user?.id, user?.plan, user?.interviewPlan, pathname])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const [snapshot, setSnapshot] = useState<{ key: string; usage: Usage | null; failed: boolean } | null>(null)
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
      setSnapshot({ key, usage: null, failed: false })
      void Promise.resolve().then(async () => {
        if (!current()) return
        try {
          const response = await readBillingResponse('/api/interview/usage', { method: 'GET' }, controller.signal)
          if (!current()) return
          const usage = response.ok ? parseInterviewUsage(response.data) : null
          setSnapshot({ key, usage, failed: !usage })
        } catch {
          if (current()) setSnapshot({ key, usage: null, failed: true })
        } finally {
          if (pending === controller) pending = null
          controller.abort()
        }
      })
    }
    load.current = read
    read()
    const interval = window.setInterval(read, 60000)
    window.addEventListener('focus', read)
    return () => { alive = false; pending?.abort(); window.clearInterval(interval); window.removeEventListener('focus', read) }
  }, [allowed, key])
  const usage = allowed && snapshot?.key === key ? snapshot.usage : null
  return { usage, failed: status === 'authenticated' && (!allowed || (snapshot?.key === key && snapshot.failed)), refresh }
}
