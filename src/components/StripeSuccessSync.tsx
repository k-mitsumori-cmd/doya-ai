'use client'

import { Suspense, useEffect, useId, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import UpgradeSuccessModal from '@/components/UpgradeSuccessModal'
import { paidTierFromSyncResult } from '@/lib/plan-utils'
import { BillingResponseError, readBillingResponse, waitForBillingClientTask } from '@/lib/billing-response-client'
import { classifyBillingReturnMarker, correlatedBillingReturnPath } from '@/lib/aio/billing-return-correlation'

/**
 * Stripe決済からの戻り（?success=true&session_id=cs_...）を**どのサービスの戻り先でも**検知し、
 * /api/stripe/sync を叩いてプランをDBへ即時反映する。
 *
 * 背景（2026-08 障害）:
 *   決済後の戻り先は checkout API が決めており banner なら `/banner` だが、
 *   同期処理は `/banner/url` にしか実装されていなかった。そのため Stripe Webhook が
 *   不達だと**プランが未来永劫 FREE のまま**になり、実際に有料契約者が無料のまま放置された。
 *   保険は「戻り先ページ」ではなくルートレイアウトに置く（＝全サービス共通で必ず走る）。
 */
function StripeSuccessSyncInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const user = session?.user as { id?: string; email?: string } | undefined
  const actor = user?.id || user?.email || ''
  const marker = classifyBillingReturnMarker(searchParams)
  const { mode, sessionId } = marker
  const returnKey = JSON.stringify([mode, sessionId, marker.fingerprint])
  const markerEpoch = useRef({ key: returnKey, version: 0 })
  if (markerEpoch.current.key !== returnKey) markerEpoch.current = { key: returnKey, version: markerEpoch.current.version + 1 }
  const identityEpoch = useRef({ actor: '', version: 0 })
  if (status === 'authenticated' && actor && identityEpoch.current.actor !== actor)
    identityEpoch.current = { actor, version: identityEpoch.current.version + 1 }
  const ownerKey = JSON.stringify([status, actor, returnKey])
  const returnEpoch = useRef({ key: ownerKey, version: 0 })
  if (returnEpoch.current.key !== ownerKey) returnEpoch.current = { key: ownerKey, version: returnEpoch.current.version + 1 }
  const [pageEpoch, setPageEpoch] = useState(0)
  const contextKey = JSON.stringify([ownerKey, markerEpoch.current.version, returnEpoch.current.version, pageEpoch])
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname
  type Failure = { actor: string; returnKey: string; mode: typeof mode; sessionId: string | null;
    markerVersion: number; identityVersion: number; pathname: string }
  const [failure, setFailure] = useState<Failure | null>(null)
  const [modal, setModal] = useState<{ actor: string; contextKey: string; identityVersion: number;
    markerVersion: number; pathname: string;
    tier: 'LIGHT' | 'PRO' | 'ENTERPRISE' } | null>(null)
  const [dismissedSignIn, setDismissedSignIn] = useState<string | null>(null)
  const [uiWarning, setUiWarning] = useState<{ actor: string; message: string } | null>(null)
  const [retrying, setRetrying] = useState(false)
  const mounted = useRef(false)
  const context = useRef(contextKey)
  context.current = contextKey
  const ready = useRef<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const attempted = useRef<string | null>(null)
  const interrupted = useRef<Failure | null>(null)
  const verified = useRef(new Map<string, { contextKey: string; markerVersion: number; identityVersion: number; uiPending: boolean }>())
  const hiddenAttempt = useRef<string | null>(null)
  const attemptScope = JSON.stringify([actor, returnKey, markerEpoch.current.version, identityEpoch.current.version])
  const run = useRef<(manual?: boolean) => Promise<void>>(async () => {})
  const resume = useRef<() => boolean>(() => false)
  const toastId = `stripe-verification-${useId()}`
  const cleanRecovery = !!failure && !marker.marked && failure.actor === actor &&
    failure.identityVersion === identityEpoch.current.version && failure.pathname === pathname &&
    failure.markerVersion + 1 === markerEpoch.current.version
  const shownFailure = status === 'authenticated' && actor && failure?.actor === actor &&
    failure.identityVersion === identityEpoch.current.version &&
    (failure.returnKey === returnKey && failure.markerVersion === markerEpoch.current.version || cleanRecovery) ? failure : null
  const needsSignIn = !!mode && status === 'unauthenticated' && dismissedSignIn !== contextKey
  const failed = !!shownFailure || needsSignIn
  const portalReturnFailed = shownFailure?.mode === 'portal' || mode === 'portal'
  const modalPlan = status === 'authenticated' && modal?.actor === actor &&
    modal.identityVersion === identityEpoch.current.version &&
    (modal.contextKey === contextKey && modal.markerVersion === markerEpoch.current.version ||
      !marker.marked && modal.markerVersion + 1 === markerEpoch.current.version && modal.pathname === pathname) ? modal.tier : null
  const currentReady = () => mounted.current && ready.current === contextKey && context.current === contextKey
  const clearReturnQuery = () => {
    if (!currentReady()) return
    const url = new URL(window.location.href)
    const present = classifyBillingReturnMarker(url.searchParams)
    if (!present.automatic || present.fingerprint !== marker.fingerprint || present.mode !== mode || present.sessionId !== sessionId) return
    if (mode === 'checkout') {
      url.pathname = correlatedBillingReturnPath(url.pathname, mode, sessionId)
      for (const name of ['session_id', 'success', 'plan']) url.searchParams.delete(name)
    } else if (mode === 'portal') {
      url.pathname = correlatedBillingReturnPath(url.pathname, mode, null)
      url.searchParams.delete('portal_return')
    } else return
    router.replace(url.pathname + url.search + url.hash, { scroll: false })
  }
  resume.current = () => {
    const receipt = verified.current.get(JSON.stringify([actor, returnKey]))
    if (!currentReady() || status !== 'authenticated' || !mode || !receipt || active.current ||
      receipt.markerVersion !== markerEpoch.current.version ||
      receipt.identityVersion !== identityEpoch.current.version) return false
    try {
      if (receipt.uiPending) { router.refresh(); receipt.uiPending = false }
      clearReturnQuery()
    } catch { setUiWarning({ actor, message: '契約は確認できましたが、画面表示を更新できませんでした。再読み込みしてください。' }) }
    return true
  }
  run.current = async (manual = false) => {
    if (!currentReady() || active.current || status !== 'authenticated' || !actor) return
    const target: Failure = manual && shownFailure ? shownFailure : { actor, returnKey, mode, sessionId,
      markerVersion: markerEpoch.current.version, identityVersion: identityEpoch.current.version, pathname }
    if (!target.mode) return
    const controller = new AbortController()
    active.current = controller
    attempted.current = contextKey
    interrupted.current = target
    const owned = () => currentReady() && active.current === controller
    const current = () => owned() && !controller.signal.aborted
    setRetrying(true)
    setModal(null)
    setUiWarning(null)
    try {
      // Bad return IDs never authorize a sync. Manual recovery may discover the
      // current actor's existing contract instead, without creating a checkout.
      const exact = target.mode === 'checkout' && (marker.automatic || manual && cleanRecovery) && target.sessionId !== null
      if (!manual && !marker.automatic) throw new BillingResponseError()
      toast.loading(target.mode === 'portal' ? '契約状況を確認しています…' : '決済を確認しています…', { id: toastId })
      const response = await readBillingResponse(exact ? '/api/stripe/sync' : '/api/stripe/sync/latest', {
        method: 'POST',
        ...(exact ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: target.sessionId }) } : {}),
      }, controller.signal)
      if (!current()) return
      const { data } = response
      if (!response.ok || data.ok !== true || typeof data.plan !== 'string' || data.code !== undefined || data.error !== undefined) throw new BillingResponseError()
      const tier = paidTierFromSyncResult(data.plan)
      const receiptKey = JSON.stringify([actor, target.returnKey])
      const first = !verified.current.has(receiptKey)
      const receipt = { contextKey, markerVersion: markerEpoch.current.version,
        identityVersion: identityEpoch.current.version, uiPending: true }
      verified.current.set(receiptKey, receipt)
      if (verified.current.size > 100) verified.current.delete(verified.current.keys().next().value!)
      interrupted.current = null
      setFailure(null)
      toast.dismiss(toastId)
      if (target.mode === 'checkout' && exact) {
        setModal({ actor, contextKey, identityVersion: identityEpoch.current.version,
          markerVersion: markerEpoch.current.version, pathname, tier })
        if (first && exact) {
          try {
            window.dispatchEvent(new CustomEvent('doya:checkout-verified', { detail: {
              sessionId: target.sessionId, plan: data.plan,
              paymentStatus: typeof data.paymentStatus === 'string' && ['paid', 'unpaid', 'no_payment_required'].includes(data.paymentStatus) ? data.paymentStatus : undefined,
              amountTotal: typeof data.amountTotal === 'number' && Number.isSafeInteger(data.amountTotal) && data.amountTotal >= 0 ? data.amountTotal : undefined,
              currency: typeof data.currency === 'string' && /^[A-Za-z]{3}$/.test(data.currency) ? data.currency.toUpperCase() : undefined,
              subscriptionStatus: typeof data.subscriptionStatus === 'string' && ['active', 'trialing', 'past_due'].includes(data.subscriptionStatus) ? data.subscriptionStatus : undefined,
            } }))
          } catch {}
        }
      } else toast.success('最新の契約内容を確認しました', { id: toastId })
      try {
        window.dispatchEvent(new CustomEvent('doya:plan-updated', { detail: { planTier: tier, source: target.mode === 'portal' ? 'stripe-portal-return' : 'stripe-success-sync', at: Date.now() } }))
        await waitForBillingClientTask(async () => { await updateSession?.() }, controller.signal)
        if (!current()) return
        router.refresh()
        receipt.uiPending = false
      } catch {
        if (!current()) return
        setUiWarning({ actor, message: '契約は確認できましたが、画面のプラン表示を更新できませんでした。再読み込みしてください。' })
      }
      if (current()) { try { clearReturnQuery() } catch {} }
    } catch (error) {
      if (!current() || (error instanceof BillingResponseError && error.cancelled)) return
      toast.dismiss(toastId)
      setFailure(target)
      // Preserve return parameters for exact receipt recovery after reload.
    } finally {
      if (owned()) {
        active.current = null
        controller.abort()
        setRetrying(false)
      }
    }
  }
  useEffect(() => {
    let cancelled = false
    mounted.current = true
    ready.current = contextKey
    setRetrying(false)
    if (interrupted.current) setFailure(interrupted.current)
    // Deferral lets StrictMode's initial cleanup finish before any mutation.
    void Promise.resolve().then(() => {
      if (cancelled || resume.current() || attempted.current === contextKey || hiddenAttempt.current === attemptScope ||
        interrupted.current?.actor === actor && interrupted.current.returnKey === returnKey) return
      void run.current()
    })
    return () => {
      cancelled = true
      mounted.current = false
      ready.current = null
      active.current?.abort()
      active.current = null
      toast.dismiss(toastId)
    }
  }, [contextKey, toastId, attemptScope, actor, returnKey])
  useEffect(() => {
    const onHide = () => {
      if (attempted.current === contextKey) hiddenAttempt.current = attemptScope
      ready.current = null
      active.current?.abort()
      active.current = null
      toast.dismiss(toastId)
    }
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPageEpoch(value => value + 1)
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
    }
  }, [contextKey, attemptScope, toastId])
  const handleRetry = () => { if (currentReady()) void run.current(true) }
  const closeFailure = () => { if (!currentReady()) return; interrupted.current = null; setFailure(null); if (status === 'unauthenticated') setDismissedSignIn(contextKey) }
  const signInCallback = typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search + window.location.hash

  return (
    <>
      <UpgradeSuccessModal
        isOpen={modalPlan !== null}
        onClose={() => {
          if (!currentReady()) return
          setModal(null)
          router.refresh()
        }}
        planName={modalPlan ?? 'PRO'}
      />

      {/* Stripe が未確認のときは支払済みと断定しない。二重申込も避ける。 */}
      {uiWarning?.actor === actor && status === 'authenticated' && (
        <p role="status" className="fixed bottom-4 left-4 right-4 z-[10001] mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{uiWarning.message}</p>
      )}
      {failed && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="契約状態の確認" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">契約状態を確認できませんでした</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {needsSignIn ? '契約状態を確認するにはログインしてください。' : portalReturnFailed ? 'プラン変更画面から戻りましたが、最新の契約状態を確認できませんでした。' : '決済結果またはプランの反映を確認できませんでした。'}<strong className="text-gray-900">二重申込を避けるため、再申込の前に契約状態を確認してください。</strong>
              下のボタンから反映をやり直せます。
            </p>
            <div className="mt-5 flex gap-3">
              {needsSignIn ? <a className="flex-1 rounded-xl bg-[#0066ff] px-4 py-3 text-center text-sm font-bold text-white" href={`/auth/signin?callbackUrl=${encodeURIComponent(signInCallback)}`}>ログインして確認する</a> : <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="flex-1 rounded-xl bg-[#0066ff] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {retrying ? '契約を確認しています…' : '契約を確認して反映する'}
              </button>}
              <button
                type="button"
                disabled={retrying}
                onClick={closeFailure}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function StripeSuccessSync() {
  return (
    <Suspense fallback={null}>
      <StripeSuccessSyncInner />
    </Suspense>
  )
}
