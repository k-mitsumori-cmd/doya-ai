'use client'

import { useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Crown, Check, Loader2, ArrowLeft, CreditCard, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function BillingContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  const plan = (session?.user as any)?.plan || 'FREE'
  const subscriptionStatus = (session?.user as any)?.subscriptionStatus

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManage = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link href="/app" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-5 h-5" />
            ダッシュボードに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            課金・プラン
          </h1>
        </div>

        {/* 成功/キャンセルメッセージ */}
        {success && (
          <div className="card mb-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-bold text-green-900">プロプランへのアップグレードが完了しました！🎉</p>
                <p className="text-sm text-green-700">無制限にバナーを生成できます。</p>
              </div>
            </div>
          </div>
        )}

        {canceled && (
          <div className="card mb-6 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="font-bold text-yellow-900">お支払いがキャンセルされました</p>
                <p className="text-sm text-yellow-700">いつでもアップグレードできます。</p>
              </div>
            </div>
          </div>
        )}

        {/* 現在のプラン */}
        <div className="card mb-8">
          <h2 className="font-bold text-gray-900 mb-4">現在のプラン</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  plan === 'PRO' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-200'
                }`}
              >
                <Crown className={`w-7 h-7 ${plan === 'PRO' ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">
                  {plan === 'PRO' ? 'プロプラン' : '無料プラン'}
                </p>
                <p className="text-gray-500 text-sm">
                  {plan === 'PRO' ? '¥9,980/月' : '1日1枚まで無料'}
                </p>
                {subscriptionStatus === 'past_due' && (
                  <p className="text-red-500 text-sm mt-1">⚠️ 支払いに問題があります</p>
                )}
              </div>
            </div>
            {plan === 'PRO' && (
              <button
                onClick={handleManage}
                disabled={isLoading}
                className="btn-secondary"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '管理する'}
              </button>
            )}
          </div>
        </div>

        {/* プラン比較 */}
        {plan !== 'PRO' && (
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-6">プロプランにアップグレード</h2>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* 無料 */}
              <div className="p-6 border-2 border-gray-200 rounded-xl">
                <h3 className="font-bold text-gray-900 mb-2">無料プラン</h3>
                <p className="text-3xl font-bold text-gray-900 mb-4">
                  ¥0<span className="text-sm font-normal text-gray-500">/月</span>
                </p>
                <ul className="space-y-2">
                  {['1日1枚まで', 'A/B/C 3案生成', '履歴保存'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600 text-sm">
                      <Check className="w-4 h-4 text-gray-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* プロ */}
              <div className="p-6 border-2 border-blue-500 rounded-xl bg-blue-50 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  おすすめ
                </div>
                <h3 className="font-bold text-gray-900 mb-2">プロプラン</h3>
                <p className="text-3xl font-bold text-gray-900 mb-4">
                  ¥9,980<span className="text-sm font-normal text-gray-500">/月</span>
                </p>
                <ul className="space-y-2">
                  {['無制限に生成', 'ブランドキット', '高速生成', '優先サポート'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-900 text-sm">
                      <Check className="w-4 h-4 text-blue-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full btn-primary text-lg py-4"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Crown className="w-5 h-5" />
                  プロプランにアップグレード
                </>
              )}
            </button>

            <p className="text-center text-gray-500 text-sm mt-4">
              いつでもキャンセル可能 • 安全なStripe決済
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  )
}

