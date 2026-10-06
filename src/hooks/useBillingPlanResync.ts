'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BillingResponseError, readBillingResponse } from '@/lib/billing-response-client'
import { paidTierFromSyncResult } from '@/lib/plan-utils'

const UNKNOWN = '契約状態またはプランの反映を確認できませんでした。新しいお申し込みをせず、契約状態を再確認してください。'

/** A client interruption never proves cancellation of the server's sync. */
export function useBillingPlanResync({ scope, enabled, onVerified, keepBusyOnVerified = false }: {
  scope: string
  enabled: boolean
  onVerified: (tier: 'LIGHT' | 'PRO' | 'ENTERPRISE') => void
  keepBusyOnVerified?: boolean
}) {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; email?: string } | undefined
  const actor = user?.id || user?.email || ''
  const scopeKey = JSON.stringify([actor, scope])
  const contextKey = JSON.stringify([status, scopeKey, enabled])
  const context = useRef(contextKey)
  context.current = contextKey
  const ready = useRef<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const pending = useRef<{ scopeKey: string; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ scopeKey: string; message: string } | null>(null)
  useEffect(() => {
    ready.current = contextKey
    setBusy(false)
    if (pending.current) setNotice(pending.current)
    return () => {
      ready.current = null
      active.current?.abort()
      active.current = null
    }
  }, [contextKey])

  const run = async () => {
    if (ready.current !== contextKey || context.current !== contextKey || active.current || status !== 'authenticated' || !actor || !enabled) return
    const controller = new AbortController()
    active.current = controller
    pending.current = { scopeKey, message: UNKNOWN }
    setBusy(true)
    setNotice(null)
    let navigating = false
    const current = () => ready.current === contextKey && context.current === contextKey && active.current === controller && !controller.signal.aborted
    try {
      const response = await readBillingResponse('/api/stripe/sync/latest', { method: 'POST' }, controller.signal)
      if (!current()) return
      if (!response.ok) {
        setNotice({ scopeKey, message: response.status === 401 ? 'ログインし直してから契約状態を確認してください。'
          : response.status === 404 ? '有効なご契約を確認できませんでした。お支払い済みの場合は、新しいお申し込みをせずお問い合わせください。' : UNKNOWN })
        return
      }
      const { data } = response
      if (data.ok !== true || typeof data.plan !== 'string' || data.error !== undefined || data.code !== undefined) throw new BillingResponseError()
      const tier = paidTierFromSyncResult(data.plan)
      pending.current = null
      setNotice({ scopeKey, message: 'ご契約とプランの反映を確認しました。' })
      try { onVerified(tier); navigating = keepBusyOnVerified } catch {
        setNotice({ scopeKey, message: '契約は確認できましたが、画面の表示を更新できませんでした。再読み込みしてください。' })
      }
    } catch (error) {
      if (current() && !(error instanceof BillingResponseError && error.cancelled)) setNotice({ scopeKey, message: UNKNOWN })
    } finally {
      if (current() && !navigating) {
        active.current = null
        controller.abort()
        setBusy(false)
      }
    }
  }
  const allowed = status === 'authenticated' && Boolean(actor) && enabled
  return { run, busy: busy && allowed, disabled: !allowed || busy,
    message: allowed && notice?.scopeKey === scopeKey ? notice.message : null }
}
