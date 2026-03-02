'use client'

import Link from 'next/link'
import { Check, Zap, Sparkles } from 'lucide-react'
import { COPY_PRICING } from '@/lib/pricing'

export default function CopyPricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-3">料金プラン</h1>
          <p className="text-gray-500">あなたの広告制作規模に合わせてプランを選択</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {COPY_PRICING.plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-6 rounded-2xl border ${
                plan.popular
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-amber-500 text-white text-xs font-black rounded-full">
                    おすすめ
                  </span>
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {plan.popular ? (
                    <Zap className="w-5 h-5 text-amber-600" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-gray-500" />
                  )}
                  <h3 className="text-lg font-black text-gray-900">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">{plan.priceLabel}</span>
                  {plan.period && <span className="text-sm text-gray-500">{plan.period}</span>}
                </div>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${f.included ? 'text-amber-600' : 'text-gray-400'}`} />
                    <span className={f.included ? 'text-gray-700' : 'text-gray-400 line-through'}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.price === 0 ? (
                <Link
                  href="/api/auth/signin?callbackUrl=/copy/new"
                  className="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors"
                >
                  {plan.cta}
                </Link>
              ) : plan.id === 'copy-enterprise' ? (
                <Link
                  href="/copy/pricing#contact"
                  className="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors"
                >
                  {plan.cta}
                </Link>
              ) : (
                <Link
                  href="/api/auth/signin?callbackUrl=/copy/new"
                  className="block w-full py-3 text-center bg-amber-500 hover:bg-amber-400 text-white font-black rounded-xl transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-12 border-t border-gray-200 pt-10">
          <h2 className="text-xl font-black text-gray-900 mb-6 text-center">よくある質問</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: '無料プランはどのくらい使えますか？',
                a: 'ゲスト（未ログイン）は月3回、ログイン後の無料プランは月10回まで生成できます。クレジットカード不要で今すぐ試せます。',
              },
              {
                q: 'Proプランにはどんなメリットがありますか？',
                a: '月200回の生成、全広告タイプ（ディスプレイ/検索/SNS）、5種類のライタータイプ、ブラッシュアップ機能、CSV/Excelエクスポートなどが利用可能です。',
              },
              {
                q: '支払い方法は何が使えますか？',
                a: 'Stripe経由でクレジットカード（Visa, Mastercard, JCB, American Express）でのお支払いに対応しています。',
              },
              {
                q: 'いつでもキャンセルできますか？',
                a: 'はい、いつでもキャンセルできます。解約後は月末まで引き続きご利用いただけます。',
              },
            ].map((faq, i) => (
              <div key={i} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                <p className="font-bold text-gray-900 mb-2">{faq.q}</p>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
