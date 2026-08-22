'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Zap, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

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

  const handleCheckout = async () => {
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

    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/checkout', {
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
      })

      const data = await response.json()

      if (!response.ok) {
        // すでに契約が有効: 二重課金を防ぐためサーバが決済を中断した。
        // その場でプランを再同期し、画面を最新化して終わる（利用者に不安を残さない）。
        if (data?.code === 'ALREADY_SUBSCRIBED') {
          toast.loading('ご契約を確認しました。プランを反映しています…', { id: 'already-subscribed' })
          try {
            await fetch('/api/stripe/sync/latest', { method: 'POST' })
          } catch {}
          toast.success('すでにご契約済みです。プランを反映しました', { id: 'already-subscribed' })
          window.location.reload()
          return
        }
        // 代表的な設定ミス（Stripeのtest/live不一致）は分かりやすい文言で出す
        if (data?.code === 'STRIPE_MODE_MISMATCH') {
          throw new Error(data.error || '決済設定（Stripeのモード）が一致していません。管理者にお問い合わせください。')
        }
        throw new Error(data?.error || '決済セッションの作成に失敗しました')
      }

      // Stripeの決済ページにリダイレクト
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('リダイレクトURLが取得できませんでした')
      }
    } catch (error: any) {
      console.error('Checkout error:', error)
      toast.error(error.message || '決済処理中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const baseStyles = 'flex items-center justify-center gap-2 font-bold rounded-xl transition-all disabled:opacity-50'
  // secondary の場合は外部classNameを優先するため、デフォルトスタイルを薄く設定
  const variantStyles = variant === 'primary'
    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white'
    : '' // secondary は className で完全にカスタマイズ可能

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading || status === 'loading'}
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
  )
}

