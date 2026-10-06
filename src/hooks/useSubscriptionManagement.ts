'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import { parseSubscriptionMutation, type SubscriptionOperation } from '@/lib/subscription-mutation-client'
import { parseSubscriptionStatus } from '@/lib/subscription-status-client'
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus'

const UNKNOWN = '契約の変更結果を確認できませんでした。再操作の前に契約状態を再確認してください。'

/** Never retry a billing mutation automatically after an unknown outcome. */
export function useSubscriptionManagement(serviceId: 'banner' | 'seo') {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; email?: string } | undefined
  const actor = user?.id || user?.email || ''
  const allowed = status === 'authenticated' && Boolean(actor)
  const subscription = useSubscriptionStatus(serviceId)
  const scope = JSON.stringify([status, actor, serviceId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const lock = useRef({ key, busy: false, uncertain: false })
  if (lock.current.key !== key) lock.current = { key, busy: false, uncertain: false }
  const active = useRef<{ key: string; controller: AbortController } | null>(null)
  const [state, setState] = useState<{ key: string; busy: boolean; uncertain: boolean; message: string } | null>(null)
  useEffect(() => () => {
    if (active.current?.key === key) { active.current.controller.abort(); active.current = null }
  }, [key])
  const visible = allowed && state?.key === key ? state : null
  const publish = (busy: boolean, uncertain: boolean, message: string) => {
    if (context.current !== key) return
    lock.current = { key, busy, uncertain }
    setState({ key, busy, uncertain, message })
  }
  useEffect(() => {
    if (context.current === key && !visible?.busy && !visible?.uncertain && !subscription.loading && subscription.data) lock.current.busy = false
  }, [key, visible?.busy, visible?.uncertain, subscription.loading, subscription.data])
  const announce = () => {
    subscription.refresh()
    window.dispatchEvent(new CustomEvent('doya:subscription-updated', { detail: { actor } }))
  }
  const run = async (operation: SubscriptionOperation) => {
    if (!allowed || context.current !== key || lock.current.busy || lock.current.uncertain
      || subscription.loading || subscription.error || !subscription.data?.hasSubscription) return null
    const controller = new AbortController()
    active.current = { key, controller }
    const current = () => context.current === key && active.current?.controller === controller && !controller.signal.aborted
    publish(true, false, '')
    try {
      const response = await readBillingResponse(`/api/stripe/subscription/${operation}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, ...(operation === 'cancel' ? { mode: 'period_end' } : {}) }),
      }, controller.signal)
      if (!current()) return null
      if (!response.ok) {
        const message = operation === 'cancel' && response.status === 502 && response.data.code === 'CANCELLATION_INCOMPLETE'
          ? '一部の契約を解約できませんでした。解約は完了しておらず、課金が続く可能性があります。契約状態を再確認し、お問い合わせください。'
          : response.status === 401 ? 'ログインし直してから契約状態を確認してください。'
          : response.status === 409 && response.data.code === 'MULTIPLE_SUBSCRIPTIONS'
            ? '複数の契約があるため変更を確認できません。契約内容をお問い合わせください。' : UNKNOWN
        publish(false, true, message)
        return null
      }
      const confirmed = parseSubscriptionMutation(response.data, operation)
      if (!current()) return null
      publish(false, false, operation === 'cancel' ? '統一プランの解約予約を受け付けました。停止日時を確認しています。' : '統一プランの解約予約を取り消しました。契約状態を確認しています。')
      try { announce() } catch { publish(false, false, '契約の変更は確認できました。表示の更新に失敗したため、契約状態を再確認してください。') }
      lock.current.busy = true
      return confirmed
    } catch {
      if (current()) publish(false, true, UNKNOWN)
      return null
    } finally {
      if (active.current?.controller === controller) { active.current = null; controller.abort() }
    }
  }
  const recheck = async () => {
    if (!allowed || context.current !== key || lock.current.busy) return
    const controller = new AbortController()
    active.current = { key, controller }
    const current = () => context.current === key && active.current?.controller === controller && !controller.signal.aborted
    publish(true, lock.current.uncertain, '')
    try {
      const response = await readBillingResponse(`/api/stripe/subscription/status?serviceId=${serviceId}`, { method: 'GET' }, controller.signal)
      if (!current()) return
      if (!response.ok) throw new Error()
      parseSubscriptionStatus(response.data)
      publish(false, false, '現在の契約状態を確認しました。表示を更新しています。')
      try { announce() } catch { publish(false, false, '契約状態は確認できました。表示の更新に失敗したため、再確認してください。') }
      lock.current.busy = true
    } catch {
      if (current()) publish(false, true, '契約状態を確認できませんでした。時間をおいて再確認するか、お問い合わせください。')
    } finally {
      if (active.current?.controller === controller) { active.current = null; controller.abort() }
    }
  }
  const busy = Boolean(visible?.busy) || subscription.loading
  const uncertain = Boolean(visible?.uncertain)
  return { run, recheck, busy, scopeKey: key, disabled: !allowed || busy || uncertain || Boolean(subscription.error) || !subscription.data?.hasSubscription,
    data: busy || uncertain ? null : subscription.data,
    message: visible?.message || subscription.error || '', uncertain }
}
