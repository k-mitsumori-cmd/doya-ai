'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check, ArrowLeft, Sparkles, Crown, Zap, Star } from 'lucide-react'
import { KANTAN_PRICING, getAnnualMonthlyPrice } from '@/lib/pricing'

export default function KantanPricingPage() {
  const { data: session } = useSession()
  const plans = KANTAN_PRICING.plans

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blue-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/kantan" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-xl">📝</span>
            </div>
            <span className="font-bold text-gray-800">カンタンドヤAI</span>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            料金プラン
          </h1>
          <p className="text-lg text-gray-600">
            あなたの利用頻度に合ったプランをお選びください
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = plan.popular
            const Icon = index === 0 ? Sparkles : index === 1 ? Star : Crown
            
            return (
              <div 
                key={plan.id}
                className={`rounded-2xl p-6 relative ${
                  isPopular 
                    ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 shadow-lg' 
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                      人気No.1
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                    isPopular 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                      : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-6 h-6 ${isPopular ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  <div className="mt-4">
                    <span className={`text-3xl font-bold ${isPopular ? 'text-blue-600' : 'text-gray-900'}`}>
                      {plan.priceLabel}
                    </span>
                    {plan.period && (
                      <span className="text-gray-500 text-sm">{plan.period}</span>
                    )}
                  </div>
                  {plan.price > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      年払いなら ¥{getAnnualMonthlyPrice(plan.price).toLocaleString()}/月
                    </p>
                  )}
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPopular ? 'text-blue-500' : 'text-green-500'}`} />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>

                {plan.price === 0 ? (
                  <Link href="/kantan/dashboard">
                    <button className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                      {plan.cta}
                    </button>
                  </Link>
                ) : (
                  <button className={`w-full py-3 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white'
                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  }`}>
                    <Zap className="w-4 h-4" />
                    {plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 text-center mb-8">よくある質問</h3>
          <div className="space-y-4">
            {[
              { q: '無料プランでどこまで使えますか？', a: `ゲストは1日${KANTAN_PRICING.guestLimit}回、ログイン後は1日${KANTAN_PRICING.freeLimit}回まで使用できます。基本テンプレート20種類が利用可能です。` },
              { q: 'いつでも解約できますか？', a: 'はい、いつでも解約可能です。解約後も期間終了まで利用できます。' },
              { q: '年払いはできますか？', a: 'はい、年払いで20%オフになります。お支払い画面で選択できます。' },
              { q: '支払い方法は？', a: 'クレジットカード（Visa, Mastercard, JCB, AMEX）に対応しています。' },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-2">{faq.q}</h4>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
