'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check, ArrowLeft, Sparkles, Crown, Zap, Star, Building } from 'lucide-react'
import { BANNER_PRICING, getAnnualMonthlyPrice } from '@/lib/pricing'

export default function BannerPricingPage() {
  const { data: session } = useSession()
  const plans = BANNER_PRICING.plans

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/banner" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎨</span>
            </div>
            <span className="font-bold text-gray-800">ドヤバナーAI</span>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            料金プラン
          </h1>
          <p className="text-lg text-gray-600">
            ビジネス規模に合ったプランをお選びください
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = plan.popular
            const icons = [Sparkles, Star, Crown, Building]
            const Icon = icons[index] || Sparkles
            
            return (
              <div 
                key={plan.id}
                className={`rounded-2xl p-5 relative ${
                  isPopular 
                    ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 shadow-lg' 
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                      人気No.1
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                    isPopular 
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                      : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${isPopular ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                  <div className="mt-3">
                    <span className={`text-2xl font-bold ${isPopular ? 'text-purple-600' : 'text-gray-900'}`}>
                      {plan.priceLabel}
                    </span>
                    {plan.period && (
                      <span className="text-gray-500 text-xs">{plan.period}</span>
                    )}
                  </div>
                  {plan.price > 0 && plan.price < 10000 && (
                    <p className="text-xs text-gray-400 mt-1">
                      年払い ¥{getAnnualMonthlyPrice(plan.price).toLocaleString()}/月
                    </p>
                  )}
                </div>
                
                <ul className="space-y-2 mb-5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700 text-xs">
                      <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isPopular ? 'text-purple-500' : 'text-green-500'}`} />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>

                {plan.price === 0 ? (
                  <Link href="/banner/dashboard">
                    <button className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors">
                      {plan.cta}
                    </button>
                  </Link>
                ) : plan.id === 'banner-business' ? (
                  <a href="mailto:support@doya-ai.com?subject=ビジネスプランについて">
                    <button className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold rounded-xl transition-colors">
                      {plan.cta}
                    </button>
                  </a>
                ) : (
                  <button className={`w-full py-2.5 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                      : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                  }`}>
                    <Zap className="w-3.5 h-3.5" />
                    {plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 比較表 */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 text-center mb-8">プラン比較</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4">機能</th>
                  <th className="text-center py-3 px-4">フリー</th>
                  <th className="text-center py-3 px-4">スターター</th>
                  <th className="text-center py-3 px-4 bg-purple-50">プロ</th>
                  <th className="text-center py-3 px-4">ビジネス</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: '1日の生成回数', values: ['2回', '10回', '30回', '無制限'] },
                  { feature: '1日の生成案数', values: ['6案', '30案', '90案', '無制限'] },
                  { feature: 'カテゴリ', values: ['基本6種', '全12種', '全12種', '全12種'] },
                  { feature: 'ロゴ組み込み', values: ['×', '×', '○', '○'] },
                  { feature: '人物画像組み込み', values: ['×', '×', '○', '○'] },
                  { feature: 'ブランドカラー設定', values: ['×', '×', '×', '○'] },
                  { feature: 'チームメンバー', values: ['×', '×', '×', '5名まで'] },
                  { feature: 'API連携', values: ['×', '×', '×', '○'] },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">{row.feature}</td>
                    {row.values.map((val, j) => (
                      <td key={j} className={`text-center py-3 px-4 ${j === 2 ? 'bg-purple-50' : ''}`}>
                        {val === '○' ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : 
                         val === '×' ? <span className="text-gray-300">−</span> : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 text-center mb-8">よくある質問</h3>
          <div className="space-y-4">
            {[
              { q: '無料プランでどこまで使えますか？', a: `ゲストは1日${BANNER_PRICING.guestLimit}回、ログイン後は1日${BANNER_PRICING.freeLimit}回まで生成できます。基本カテゴリ6種類が利用可能です。` },
              { q: '生成した画像の著作権は？', a: '生成した画像の著作権はお客様に帰属します。商用利用も可能です。' },
              { q: 'ビジネスプランのチームメンバー追加は？', a: '5名を超える場合は、追加1名あたり¥2,000/月でご利用いただけます。' },
              { q: '年払いはできますか？', a: 'はい、年払いで20%オフになります。お支払い画面で選択できます。' },
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
