'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Zap, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { BillingResponseError, billingRedirectUrl, readBillingResponse } from '@/lib/billing-response-client'
import { paidTierFromSyncResult } from '@/lib/plan-utils'

const UNKNOWN_CHECKOUT = '決済画面を開けたか確認できませんでした。新しいお申し込みを繰り返さず、先ほどの決済画面や契約状況をご確認ください。'
const UNKNOWN_PORTAL = 'プラン変更画面を開けたか確認できませんでした。新しいお申し込みをせず、先ほどの管理画面や契約状況をご確認ください。'
const UNKNOWN_SYNC = 'ご契約は確認できましたが、プランの反映を確認できませんでした。新しいお申し込みをせず、画面を再読み込みして契約状況をご確認ください。'

interface CheckoutButtonProps {
  planId: string
  billingPeriod?: 'monthly' | 'yearly'
  loginCallbackUrl?: string
  className?: string
  children?: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export function CheckoutButton({
  planId,
  billingPeriod = 'monthly',
  loginCallbackUrl,
  className = '',
  children,
  variant = 'primary',
}: CheckoutButtonProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [noticeResult, setNotice] = useState<{ scopeKey: string; message: string } | null>(null)
  const messageId = useId()
  const user = session?.user as { id?: string; email?: string } | undefined
  const identity = user?.id || user?.email
  const scopeKey = JSON.stringify([identity, planId, billingPeriod])
  const contextKey = JSON.stringify([status, identity, planId, billingPeriod])
  const notice = status === 'authenticated' && identity && noticeResult?.scopeKey === scopeKey ? noticeResult.message : null
  const context = useRef(contextKey)
  context.current = contextKey
  const readyContext = useRef<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const pendingNotice = useRef<{ scopeKey: string; message: string } | null>(null)
  const toastId = `checkout-${messageId}`
  useEffect(() => {
    mounted.current = true
    readyContext.current = contextKey
    setIsLoading(false)
    // Cancelling a browser wait cannot establish the server mutation's outcome.
    // Keep its guidance if the same actor resumes after an auth refresh.
    if (pendingNotice.current) setNotice(pendingNotice.current)
    return () => {
      mounted.current = false
      readyContext.current = null
      active.current?.abort()
      active.current = null
      toast.dismiss(toastId)
    }
  }, [contextKey, toastId])

  const handleCheckout = async () => {
    if (!mounted.current || readyContext.current !== contextKey || context.current !== contextKey || active.current || status === 'loading') return
    // 今いる画面から「どのサービスから申し込んだか」を決める。
    // ⚠️ planId から推測してはいけない。統一プランでは全サービスが 'banner-pro' を
    //    使うため、planId 由来だと必ず banner になってしまう。
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    const firstSegment = currentPath.split('/').filter(Boolean)[0] || ''
    const originService = firstSegment && firstSegment !== 'pricing' ? firstSegment : planId.split('-')[0]

    // 未ログインの場合はログインページへ
    if (status === 'unauthenticated') {
      // ⚠️ ここも planId から推測してはいけない（統一プランでは必ず 'banner' になる）。
      //    未ログインの方がカンタンマーケの料金ページで押すと、ログイン後に
      //    ドヤバナーAIへ着地してしまう。今いる画面から決めた originService を使う。
      const service = originService
      if (service === 'banner') {
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(loginCallbackUrl || '/banner')}`)
      } else {
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(loginCallbackUrl || `/${service}/pricing`)}`)
      }
      return
    }
    if (status !== 'authenticated' || !identity) return

    const controller = new AbortController()
    active.current = controller
    pendingNotice.current = { scopeKey, message: UNKNOWN_CHECKOUT }
    const current = () => mounted.current && context.current === contextKey && active.current === controller && !controller.signal.aborted
    const fail = (message: string) => {
      if (!current()) return
      setNotice({ scopeKey, message })
      toast.error(message, { id: toastId })
    }
    let stage: 'checkout' | 'portal' | 'sync' = 'checkout'
    let navigating = false
    setIsLoading(true)
    setNotice(null)

    try {
      const response = await readBillingResponse('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          billingPeriod,
          // ⚠️ 統一プランでは全サービスが同じ planId('banner-pro') を使うため、
          //    planId から戻り先を推測すると**どのサービスから申し込んでも
          //    ドヤバナーAIに飛ばされる**。今いる画面を渡して元の場所へ戻す。
          returnTo: currentPath || undefined,
          serviceId: originService,
        }),
      }, controller.signal)
      if (!current()) return
      const { data } = response

      if (!response.ok) {
        if (response.status === 409 && data.code === 'PLAN_CHANGE_REQUIRED') {
          stage = 'portal'
          pendingNotice.current = { scopeKey, message: UNKNOWN_PORTAL }
          const portalResponse = await readBillingResponse('/api/stripe/portal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnTo: currentPath || '/', purpose: 'plan_change' }),
          }, controller.signal)
          if (!current()) return
          const url = billingRedirectUrl(portalResponse.data.url)
          if (!portalResponse.ok || !url || portalResponse.data.code !== undefined || portalResponse.data.error !== undefined) throw new BillingResponseError()
          window.location.href = url
          navigating = true
          return
        }
        // すでに契約が有効: 二重課金を防ぐためサーバが決済を中断した。
        // 再同期の成功を確認できた場合だけ、反映済みと伝えて画面を更新する。
        if (response.status === 409 && data.code === 'ALREADY_SUBSCRIBED') {
          stage = 'sync'
          pendingNotice.current = { scopeKey, message: UNKNOWN_SYNC }
          toast.loading('ご契約を確認しました。プランを反映しています…', { id: toastId })
          const syncResponse = await readBillingResponse('/api/stripe/sync/latest', { method: 'POST' }, controller.signal)
          if (!current()) return
          if (!syncResponse.ok || syncResponse.data.ok !== true || syncResponse.data.code !== undefined || syncResponse.data.error !== undefined) throw new BillingResponseError()
          if (typeof syncResponse.data.plan !== 'string') throw new BillingResponseError()
          paidTierFromSyncResult(syncResponse.data.plan)
          toast.success('ご契約のプランを反映しました', { id: toastId })
          window.location.reload()
          navigating = true
          return
        }
        const messages: Record<string, [number, string]> = {
          STRIPE_MODE_MISMATCH: [400, '決済設定を確認する必要があります。管理者にお問い合わせください。'],
          TRIAL_CHECK_UNAVAILABLE: [503, '無料期間の対象か確認できなかったため、決済を開始していません。時間をおいて再度お試しください。'],
          SUBSCRIPTION_CHECK_UNAVAILABLE: [503, '現在の契約状況を確認できなかったため、決済を開始していません。時間をおいて再度お試しください。'],
          HR_BILLING_OWNER_REQUIRED: [403, 'この組織のプランはオーナーのみ変更できます。組織のオーナーにご確認ください。'],
          CHECKOUT_IN_PROGRESS: [409, '決済画面の作成・利用状況を確認中です。新しいお申し込みを繰り返さず、先ほどの決済画面や契約状況をご確認ください。'],
          CHECKOUT_ALREADY_COMPLETED: [409, '直前のお申し込みを確認中です。新しいお申し込みを繰り返さず、画面を再読み込みして契約状況をご確認ください。'],
        }
        const known = typeof data.code === 'string' && Object.hasOwn(messages, data.code) ? messages[data.code] : undefined
        if (known && response.status === known[0]) { fail(known[1]); return }
        if (response.status === 401) { fail('ログインの有効期限を確認できませんでした。画面を再読み込みしてログインし直してください。'); return }
        if (response.status === 410) { fail('選択したプランは提供を終了しています。現在の料金ページで利用可能なプランをご確認ください。'); return }
        throw new BillingResponseError()
      }

      // Stripeの決済ページにリダイレクト
      const url = billingRedirectUrl(data.url)
      if (!url || typeof data.sessionId !== 'string' || !data.sessionId || data.code !== undefined || data.error !== undefined) throw new BillingResponseError()
      window.location.href = url
      navigating = true
    } catch (error) {
      if (error instanceof BillingResponseError && error.cancelled) return
      fail(stage === 'sync' ? UNKNOWN_SYNC : stage === 'portal' ? UNKNOWN_PORTAL : UNKNOWN_CHECKOUT)
    } finally {
      if (current() && !navigating) {
        active.current = null
        pendingNotice.current = null
        controller.abort()
        setIsLoading(false)
      }
    }
  }

  const baseStyles = 'flex items-center justify-center gap-2 font-bold rounded-xl transition-all disabled:opacity-50'
  // secondary の場合は外部classNameを優先するため、デフォルトスタイルを薄く設定
  const variantStyles = variant === 'primary'
    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white'
    : '' // secondary は className で完全にカスタマイズ可能

  return (
    <>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading || status === 'loading' || (status === 'authenticated' && !identity)}
        aria-busy={isLoading}
        aria-describedby={notice ? messageId : undefined}
        className={`${baseStyles} ${variantStyles} ${className}`.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            処理中...
          </>
        ) : (
          <>
            {variant === 'primary' ? <Zap className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
            {children || 'プランを選択'}
          </>
        )}
      </button>
      {notice && <p id={messageId} role="status" className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium leading-relaxed text-rose-900">{notice}</p>}
    </>
  )
}
