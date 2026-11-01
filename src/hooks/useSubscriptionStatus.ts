'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import { parseSubscriptionStatus, type SubscriptionStatusSnapshot } from '@/lib/subscription-status-client'

const UNKNOWN = '契約状態と停止日時を確認できませんでした。契約状態を再確認してください。'

/** Read-only status is scoped to the authenticated actor, service and refresh. */
export function useSubscriptionStatus(serviceId: 'banner' | 'seo') {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; email?: string } | undefined
  const actor = user?.id || user?.email || ''
  const allowed = status === 'authenticated' && Boolean(actor)
  const [revision, setRevision] = useState(0)
  const scope = JSON.stringify([status, actor, serviceId, revision])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const active = useRef<AbortController | null>(null)
  const [result, setResult] = useState<{ key: string; data: SubscriptionStatusSnapshot | null; error: string | null; loading: boolean } | null>(null)
  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    const controller = new AbortController()
    active.current = controller
    const current = () => !cancelled && context.current === key && active.current === controller && !controller.signal.aborted
    setResult({ key, data: null, error: null, loading: true })
    // Finish StrictMode's initial cleanup before starting any request.
    void Promise.resolve().then(async () => {
      if (!current()) return
      try {
        const response = await readBillingResponse(`/api/stripe/subscription/status?serviceId=${serviceId}`, { method: 'GET' }, controller.signal)
        if (!current()) return
        if (!response.ok) {
          const error = response.status === 409 && response.data.code === 'MULTIPLE_SUBSCRIPTIONS'
            ? '複数の契約があるため停止日時を確認できません。契約内容をお問い合わせください。'
            : response.status === 401 ? 'ログインし直してから契約状態を確認してください。' : UNKNOWN
          setResult({ key, data: null, error, loading: false })
          return
        }
        const data = parseSubscriptionStatus(response.data)
        if (current()) setResult({ key, data, error: null, loading: false })
      } catch {
        if (current()) setResult({ key, data: null, error: UNKNOWN, loading: false })
      } finally {
        if (active.current === controller) { active.current = null; controller.abort() }
      }
    })
    return () => { cancelled = true; controller.abort(); if (active.current === controller) active.current = null }
  }, [key, allowed, serviceId])
  useEffect(() => {
    if (!allowed) return
    const updated = (event: Event) => {
      if ((event as CustomEvent<{ actor?: string }>).detail?.actor !== actor || context.current !== key) return
      active.current?.abort()
      active.current = null
      setRevision(value => value + 1)
    }
    window.addEventListener('doya:subscription-updated', updated)
    return () => window.removeEventListener('doya:subscription-updated', updated)
  }, [allowed, actor, key])
  const visible = allowed && result?.key === key ? result : null
  const refresh = () => { if (allowed && context.current === key && !active.current) setRevision(value => value + 1) }
  return { data: visible?.data ?? null, error: visible?.error ?? null,
    loading: allowed && (!visible || visible.loading), refresh }
}
