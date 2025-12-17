'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Zap, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

interface CheckoutButtonProps {
  planId: string
  billingPeriod?: 'monthly' | 'yearly'
  className?: string
  children?: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export function CheckoutButton({
  planId,
  billingPeriod = 'monthly',
  className = '',
  children,
  variant = 'primary',
}: CheckoutButtonProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async () => {
    // 未ログインの場合はログインページへ
    if (status === 'unauthenticated') {
      const service = planId.split('-')[0]
      router.push(`/auth/signin?callbackUrl=/${service}/pricing`)
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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '決済セッションの作成に失敗しました')
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
  const variantStyles = variant === 'primary'
    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading || status === 'loading'}
      className={`${baseStyles} ${variantStyles} ${className}`}
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

