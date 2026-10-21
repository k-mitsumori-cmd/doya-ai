'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, Zap, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { BillingResponseError, billingRedirectUrl, readBillingResponse } from '@/lib/billing-response-client'
import { checkoutScopeKey, type CheckoutIntent, type CheckoutOutcome } from '@/lib/checkout-recovery-client'
import { useCheckoutRecovery } from '@/components/CheckoutRecoveryProvider'
import { paidTierFromSyncResult } from '@/lib/plan-utils'

const UNKNOWN_CHECKOUT = '先ほどのお申し込みの状態を確認してください。結果が不明な間は新しく申し込まないでください。'
const UNKNOWN_PORTAL = 'プラン変更画面を開けたか確認できませんでした。新しいお申し込みをせず、契約状況をご確認ください。'
const UNKNOWN_SYNC = '契約の反映を確認できませんでした。新しいお申し込みをせず、契約状況をご確認ください。'

interface CheckoutButtonProps {
  planId: string
  billingOrganization?: { actor: string; organizationId: string }
  billingPeriod?: 'monthly' | 'yearly'
  loginCallbackUrl?: string
  className?: string
  children?: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export function CheckoutButton({ planId, billingOrganization, billingPeriod = 'monthly', loginCallbackUrl,
  className = '', children, variant = 'primary' }: CheckoutButtonProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { manager, snapshot } = useCheckoutRecovery()
  const [isLoading, setIsLoading] = useState(false)
  const [noticeResult, setNotice] = useState<{ scopeKey: string; message: string } | null>(null)
  const messageId = useId()
  const user = session?.user as { id?: string } | undefined
  const actorId = status === 'authenticated' ? user?.id : undefined
  const currentPath = pathname || ''
  const segment = currentPath.split('/').filter(Boolean)[0] || ''
  const serviceId = segment && !['pricing', 'all-in-one'].includes(segment) ? segment : planId.split('-')[0]
  const organizationId = billingOrganization?.organizationId || null
  const organizationActor = billingOrganization?.actor || null
  const intent = useMemo<CheckoutIntent>(() => ({ planId, billingPeriod, serviceId, returnTo: currentPath || null,
    organization: organizationId && organizationActor ? { actor: organizationActor, organizationId } : null }),
  [planId, billingPeriod, serviceId, currentPath, organizationId, organizationActor])
  const scopeKey = checkoutScopeKey(intent)
  const contextKey = JSON.stringify([status, actorId, scopeKey])
  const context = useRef(contextKey); context.current = contextKey
  const lease = useRef<{ active: boolean } | null>(null)
  const active = useRef<AbortController | null>(null)
  const toastId = `checkout-${messageId}`
  const organizationValid = !billingOrganization || (serviceId === 'hr' && organizationActor === actorId &&
    Boolean(organizationId) && !/[\s\u0000-\u001f\u007f]/.test(organizationId || ''))
  const ownHandle = Boolean(snapshot.handle && actorId && snapshot.handle.actorId === actorId && snapshot.handle.scopeKey === scopeKey)
  const foreignScope = Boolean(snapshot.handle && !ownHandle)
  const abortedForeign = Boolean(foreignScope && snapshot.phase === 'aborted' && snapshot.handle?.actorId === actorId)
  const notice = noticeResult?.scopeKey === scopeKey ? noticeResult.message :
    foreignScope && !abortedForeign ? '先ほどの別のお申し込みが残っています。元の画面で状態を確認してください。' :
    ownHandle ? snapshot.message : null

  useEffect(() => {
    const ownLease = { active: true }; lease.current = ownLease
    setIsLoading(false)
    if (status === 'authenticated' && actorId && manager && organizationValid) void manager.observe(intent,
      () => ownLease.active && lease.current === ownLease && context.current === contextKey)
    return () => { ownLease.active = false; if (lease.current === ownLease) lease.current = null
      active.current?.abort(); active.current = null; toast.dismiss(toastId) }
  }, [status, actorId, manager, organizationValid, intent, contextKey, toastId])

  const handleCheckout = async () => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(loginCallbackUrl || (serviceId === 'banner' ? '/banner' : `/${serviceId}/pricing`))}`)
      return
    }
    if (status !== 'authenticated' || !actorId || !manager || !organizationValid || foreignScope && !abortedForeign || active.current || snapshot.busy) return
    const ownLease = lease.current
    if (!ownLease?.active) return
    const controller = new AbortController(); active.current = controller
    const current = () => ownLease.active && lease.current === ownLease && context.current === contextKey &&
      active.current === controller && !controller.signal.aborted
    const fail = (message: string) => { if (current()) { setNotice({ scopeKey, message }); toast.error(message, { id: toastId }) } }
    let stage: 'checkout' | 'portal' | 'sync' = 'checkout'
    let navigating = false
    setIsLoading(true); setNotice(null)
    try {
      let outcome: CheckoutOutcome | null = null
      const phase = snapshot.phase
      if (!snapshot.handle && phase === 'idle') outcome = await manager.start(intent, current)
      else if (abortedForeign) outcome = await manager.newAfterTerminal(intent, current)
      else if (ownHandle && phase === 'missing') await manager.abortMissing(intent, current)
      else if (ownHandle && phase === 'reserved' && !snapshot.dispatched) outcome = await manager.resume(intent, current)
      else if (ownHandle && phase === 'completed') outcome = await manager.readyAgain(intent, current)
      else if (ownHandle && phase === 'provider_complete') outcome = { kind: 'provider_complete' }
      else if (ownHandle && (phase === 'expired' || phase === 'aborted')) outcome = await manager.newAfterTerminal(intent, current)
      else if (ownHandle && ['unknown', 'executing', 'checking'].includes(phase)) await manager.status(intent, current)
      if (!current()) return
      if (outcome?.kind === 'ready') {
        if (manager.snapshot().handle?.scopeKey !== scopeKey) throw new BillingResponseError()
        window.location.href = outcome.url; navigating = true; return
      }
      if (outcome?.kind === 'plan_change') {
        stage = 'portal'
        const response = await readBillingResponse('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnTo: currentPath || '/', purpose: 'plan_change' }) }, controller.signal)
        if (!current()) return
        const url = billingRedirectUrl(response.data.url)
        if (!response.ok || !url || response.data.code !== undefined || response.data.error !== undefined) throw new BillingResponseError()
        window.location.href = url; navigating = true; return
      }
      if (outcome?.kind === 'subscribed' || outcome?.kind === 'provider_complete') {
        stage = 'sync'
        toast.loading('ご契約を確認しています…', { id: toastId })
        const response = await readBillingResponse('/api/stripe/sync/latest', { method: 'POST' }, controller.signal)
        if (!current()) return
        if (!response.ok || response.data.ok !== true || response.data.code !== undefined || response.data.error !== undefined ||
          typeof response.data.plan !== 'string') throw new BillingResponseError()
        paidTierFromSyncResult(response.data.plan)
        toast.success('ご契約のプランを反映しました', { id: toastId })
        window.location.reload(); navigating = true; return
      }
      if (manager.snapshot().phase === 'unknown') fail(UNKNOWN_CHECKOUT)
    } catch (error) {
      if (error instanceof BillingResponseError && error.cancelled) return
      fail(stage === 'portal' ? UNKNOWN_PORTAL : stage === 'sync' ? UNKNOWN_SYNC : UNKNOWN_CHECKOUT)
    } finally {
      if (current() && !navigating) { active.current = null; controller.abort(); setIsLoading(false) }
    }
  }

  const phase = snapshot.phase
  const label = isLoading || snapshot.busy || phase === 'checking' ? '状態を確認中…' :
    abortedForeign ? '新しく申し込む' : foreignScope ? '先ほどの申込を確認' : ownHandle && phase === 'missing' ? '申込を中止して確認' :
    ownHandle && phase === 'reserved' && !snapshot.dispatched ? '決済画面の準備を再開' :
    ownHandle && phase === 'completed' ? '決済画面へ進む' :
    ownHandle && phase === 'provider_complete' ? '契約状況を確認' :
    ownHandle && (phase === 'expired' || phase === 'aborted') ? '新しく申し込む' :
    ownHandle && ['unknown', 'executing'].includes(phase) ? '申込状況を確認' : children || 'プランを選択'
  const disabled = isLoading || snapshot.busy || (status === 'authenticated' && (phase === 'checking' || phase === 'blocked' || foreignScope && !abortedForeign || !actorId || !organizationValid)) || status === 'loading'
  const baseStyles = 'flex items-center justify-center gap-2 font-bold rounded-xl transition-all disabled:opacity-50'
  const variantStyles = variant === 'primary' ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white' : ''
  return <>
    <button type="button" onClick={handleCheckout} disabled={disabled} aria-busy={isLoading || snapshot.busy}
      aria-describedby={notice ? messageId : undefined} className={`${baseStyles} ${variantStyles} ${className}`.trim()}>
      {isLoading || snapshot.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : variant === 'primary' ? <Zap className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
      {label}
    </button>
    {notice && <p id={messageId} role="status" className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium leading-relaxed text-rose-900">{notice}</p>}
  </>
}
