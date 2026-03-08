'use client'

import { useState, Suspense } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, Crown, Sparkles, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

function PricingContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  const canceled = searchParams.get('canceled')
  const success = searchParams.get('success')

  const handleSubscribeLight = async () => {
    if (!session) {
      signIn('google', { callbackUrl: '/pricing' })
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'banner-light', billingPeriod: 'monthly' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'エラーが発生しました')
      window.location.href = data.url
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!session) {
      signIn('google', { callbackUrl: '/pricing' })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'banner-pro', billingPeriod: 'monthly' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      window.location.href = data.url
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscribeEnterprise = async () => {
    if (!session) {
      signIn('google', { callbackUrl: '/pricing' })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'banner-enterprise', billingPeriod: 'monthly' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'エラーが発生しました')
      window.location.href = data.url
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      window.location.href = data.url
    } catch (error) {
      console.error('Portal error:', error)
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const plan = String((session?.user as any)?.plan || 'FREE').toUpperCase()
  const isLight = plan === 'LIGHT'
  const isPro = plan === 'PRO' || plan === 'ENTERPRISE'
  const isEnterprise = plan === 'ENTERPRISE'
  const isPaid = isLight || isPro

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b-2 border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={session ? '/banner' : '/'}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">ドヤAI 料金</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 通知メッセージ */}
        {canceled && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 text-center">
            お支払いがキャンセルされました。いつでもアップグレードできます。
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 text-center">
            🎉 有料プランへのアップグレードありがとうございます！
          </div>
        )}

        {isPaid ? (
          /* 有料版の場合 */
          <div className="text-center py-12">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isEnterprise ? 'bg-gradient-to-br from-slate-700 to-slate-900'
              : isPro ? 'bg-gradient-to-br from-amber-400 to-orange-500'
              : 'bg-gradient-to-br from-blue-400 to-blue-600'
            }`}>
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {isEnterprise ? 'エンタープライズをご利用中です' : isPro ? 'プロプランをご利用中です' : 'ライトプランをご利用中です'}
            </h1>
            <p className="text-gray-600 mb-8 text-lg">
              {isEnterprise ? '月1000枚まで生成できます' : isPro ? '月150枚まで生成できます' : '月50枚まで生成できます'}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleManageSubscription}
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3 rounded-xl transition-colors"
              >
                {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                サブスクリプションを管理
              </button>
              {isLight && (
                <button
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  PROにアップグレード（¥9,980/月）
                </button>
              )}
              <p className="text-sm text-gray-500">
                解約・プラン管理はこちらから
              </p>
            </div>
          </div>
        ) : (
          /* 通常ユーザーの場合 */
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                料金プラン
              </h1>
              <p className="text-gray-600 text-lg">
                LIGHT（¥2,980 / 月50枚）、PRO（¥9,980 / 月150枚）、Enterprise（¥49,800 / 月1000枚）
              </p>
            </div>

            {/* プラン比較 */}
            <div className="space-y-4 mb-8">
              {/* 無料プラン */}
              <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">無料版</h2>
                    <p className="text-gray-600">登録するだけで使える</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">¥0</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {[
                    '月15枚まで生成',
                    '基本機能の利用',
                    '履歴保存（7日間）',
                    'メールサポート',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {!session ? (
                  <button
                    onClick={() => signIn('google', { callbackUrl: '/banner' })}
                    className="w-full py-4 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-900 font-bold rounded-xl transition-colors text-lg"
                  >
                    無料で登録する
                  </button>
                ) : (
                  <Link href="/banner">
                    <button className="w-full py-4 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-900 font-bold rounded-xl transition-colors text-lg">
                      ダッシュボードへ
                    </button>
                  </Link>
                )}
              </div>

              {/* ライトプラン */}
              <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200 relative">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">ライトプラン</h2>
                    <p className="text-gray-600">お手軽に始めたい方に</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-700">¥2,980</p>
                    <p className="text-sm text-gray-500">/月（税込）</p>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {[
                    '月50枚まで生成',
                    '同時生成: 最大3枚',
                    '履歴保存（無制限）',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleSubscribeLight}
                  disabled={isLoading}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-lg flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      ライトプランを始める
                    </>
                  )}
                </button>
              </div>

              {/* 有料版 */}
              <div className="bg-blue-600 rounded-2xl p-6 text-white relative">
                <div className="absolute -top-3 left-4 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Crown className="w-4 h-4" />
                  人気No.1
                </div>
                <div className="flex items-center justify-between mb-4 mt-2">
                  <div>
                    <h2 className="text-xl font-bold">有料版</h2>
                    <p className="opacity-90">たくさん使いたい方に</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">¥9,980</p>
                    <p className="text-sm opacity-80">/月（税込）</p>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {[
                    '月150枚まで生成',
                    'サイズ自由指定',
                    '同時生成: 最大5枚',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  className="w-full py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors text-lg flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      有料版を始める
                    </>
                  )}
                </button>
              </div>

              {/* Enterprise */}
              <div className="bg-slate-900 rounded-2xl p-6 text-white relative border border-slate-800">
                <div className="flex items-center justify-between mb-4 mt-2">
                  <div>
                    <h2 className="text-xl font-bold">エンタープライズ</h2>
                    <p className="opacity-90">大量生成・チーム運用向け</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">¥49,800</p>
                    <p className="text-sm opacity-80">/月（税込）</p>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {[
                    '月1000枚まで生成',
                    '大量運用・チーム向け',
                    '優先サポート',
                    'さらに上限UP相談可',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleSubscribeEnterprise}
                  disabled={isLoading}
                  className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-50 transition-colors text-lg flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5" />
                      エンタープライズを始める
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">よくある質問</h3>
              <div className="space-y-4">
                {[
                  {
                    q: '支払い方法は？',
                    a: 'クレジットカード（Visa, Mastercard, JCB, American Express）に対応しています。',
                  },
                  {
                    q: 'いつでも解約できますか？',
                    a: 'はい、いつでもキャンセルできます。解約後も期間終了までご利用いただけます。',
                  },
                  {
                    q: '生成した文章の著作権は？',
                    a: '生成した文章はすべてお客様に帰属します。商用利用も可能です。',
                  },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="font-bold text-gray-900 mb-1">Q. {item.q}</p>
                    <p className="text-gray-600 text-sm">A. {item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-4">
                まずは無料で試してみませんか？
              </p>
              <button
                onClick={() => signIn('google', { callbackUrl: '/kantan/dashboard' })}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl transition-colors text-lg"
              >
                <Sparkles className="w-5 h-5" />
                無料で始める
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}
