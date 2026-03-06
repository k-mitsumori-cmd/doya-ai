'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check, Zap, Sparkles } from 'lucide-react'
import { COPY_PRICING } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

export default function CopyPricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.copyPlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-3">料金プラン</h1>
          <p className="text-gray-500">あなたの広告制作規模に合わせてプランを選択</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {COPY_PRICING.plans.map((plan) => {
            const isCurrent =
              (plan.id === 'copy-free' && (currentPlan === 'FREE' || currentPlan === 'GUEST')) ||
              (plan.id === 'copy-light' && currentPlan === 'LIGHT') ||
              (plan.id === 'copy-pro' && currentPlan === 'PRO') ||
              (plan.id === 'copy-enterprise' && currentPlan === 'ENTERPRISE')

            return (
              <div
                key={plan.id}
                className={`relative p-6 rounded-2xl border ${
                  plan.popular
                    ? 'border-amber-500 bg-amber-50'
                    : isCurrent
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-gray-200 bg-white shadow-sm'
                }`}
              >
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-amber-500 text-white text-xs font-black rounded-full">
                      おすすめ
                    </span>
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-emerald-500 text-white text-xs font-black rounded-full">
                      現在のプラン
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

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-center text-sm font-bold text-emerald-600 border border-emerald-300 bg-emerald-50">
                    利用中
                  </div>
                ) : plan.id === 'copy-free' ? (
                  <Link
                    href="/copy/new"
                    className="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors"
                  >
                    {plan.cta}
                  </Link>
                ) : plan.id === 'copy-enterprise' ? (
                  <a
                    href="mailto:k-mitsumori@surisuta.jp?subject=ドヤコピーAI Enterprise問い合わせ"
                    className="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors"
                  >
                    {plan.cta}
                  </a>
                ) : plan.id === 'copy-light' ? (
                  <CheckoutButton
                    planId="copy-light"
                    loginCallbackUrl="/copy/pricing"
                    variant="primary"
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-blue-600 hover:bg-blue-700"
                  >
                    {plan.cta}
                  </CheckoutButton>
                ) : (
                  <CheckoutButton
                    planId="copy-pro"
                    loginCallbackUrl="/copy/pricing"
                    variant="secondary"
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-amber-500 hover:bg-amber-400"
                  >
                    {plan.cta}
                  </CheckoutButton>
                )}
              </div>
            )
          })}
        </div>

        {/* 比較表 */}
        <div className="mt-12 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-4 text-center">プラン比較</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">機能</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Free</th>
                  <th className="text-center py-3 px-4 text-blue-600 font-medium">ライト</th>
                  <th className="text-center py-3 px-4 text-amber-600 font-bold">Pro</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['月間生成回数', '10回', '50回', '200回', '1,000回'],
                  ['ディスプレイ広告', '✓', '✓', '✓', '✓'],
                  ['検索広告(Google/Yahoo!)', '---', '---', '✓', '✓'],
                  ['SNS広告(Meta/X/LINE)', '---', '---', '✓', '✓'],
                  ['ライタータイプ', '1種', '3種', '5種(全種)', '5種(全種)'],
                  ['ブラッシュアップ', '---', '✓', '✓ 無制限', '✓ 無制限'],
                  ['CSV/Excelエクスポート', '---', '---', '✓', '✓'],
                  ['レギュレーション設定', '---', '---', '✓', '✓'],
                  ['ブランドボイス保存', '---', '---', '3件', '無制限'],
                  ['履歴保存', '7日間', '無制限', '無制限', '無制限'],
                ].map(([feature, free, light, pro, enterprise], i) => (
                  <tr key={feature} className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                    <td className="py-3 px-4 text-gray-700">{feature}</td>
                    <td className="py-3 px-4 text-center text-gray-500">{free}</td>
                    <td className="py-3 px-4 text-center text-blue-600">{light}</td>
                    <td className="py-3 px-4 text-center text-amber-600 font-semibold bg-amber-50/50">{pro}</td>
                    <td className="py-3 px-4 text-center text-gray-500">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
