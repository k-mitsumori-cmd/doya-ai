'use client'

import { motion } from 'framer-motion'
import { Check, X, Zap } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { LP_PRICING } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

const planColors: Record<string, { border: string; bg: string; ctaColor: string }> = {
  'lp-free': {
    border: 'border-slate-700',
    bg: 'bg-slate-900',
    ctaColor: 'border border-cyan-600 text-cyan-400 hover:bg-cyan-500/10',
  },
  'lp-light': {
    border: 'border-blue-500',
    bg: 'bg-blue-500/5',
    ctaColor: 'border border-blue-500 text-blue-400 hover:bg-blue-500/10',
  },
  'lp-pro': {
    border: 'border-cyan-500',
    bg: 'bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.1)]',
    ctaColor: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black',
  },
  'lp-enterprise': {
    border: 'border-slate-700',
    bg: 'bg-slate-900',
    ctaColor: 'border border-slate-600 text-slate-300 hover:bg-slate-800',
  },
}

export default function LpPricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.lpPlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4">料金プラン</h1>
          <p className="text-slate-400">AIでLPを自動生成。あなたに合ったプランをお選びください。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {LP_PRICING.plans.map((plan, i) => {
            const colors = planColors[plan.id] || planColors['lp-free']
            const isCurrent =
              (plan.id === 'lp-free' && (currentPlan === 'FREE' || currentPlan === 'GUEST')) ||
              (plan.id === 'lp-light' && currentPlan === 'LIGHT') ||
              (plan.id === 'lp-pro' && currentPlan === 'PRO') ||
              (plan.id === 'lp-enterprise' && currentPlan === 'ENTERPRISE')

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border p-7 ${colors.border} ${colors.bg}`}
              >
                {plan.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-cyan-500 rounded-full text-xs font-bold text-slate-950">
                    <Zap className="w-3 h-3" />
                    人気
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                      現在のプラン
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-xs mb-4">{plan.description}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-3xl font-black text-white">{plan.priceLabel}</span>
                  {plan.period && <span className="text-xs text-slate-500 mb-1">{plan.period}</span>}
                </div>

                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-700 flex-shrink-0" />
                      )}
                      <span className={f.included ? 'text-slate-300' : 'text-slate-600'}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-center text-sm font-bold text-emerald-300 border border-emerald-700/40 bg-emerald-900/20">
                    利用中
                  </div>
                ) : plan.id === 'lp-free' ? (
                  <Link
                    href="/lp/new/input"
                    className={`block w-full py-3 rounded-xl text-sm font-bold text-center transition-colors ${colors.ctaColor}`}
                  >
                    {plan.cta}
                  </Link>
                ) : plan.id === 'lp-enterprise' ? (
                  <a
                    href="mailto:k-mitsumori@surisuta.jp?subject=ドヤLP AI Enterprise問い合わせ"
                    className={`block w-full py-3 rounded-xl text-sm font-bold text-center transition-colors ${colors.ctaColor}`}
                  >
                    {plan.cta}
                  </a>
                ) : plan.id === 'lp-light' ? (
                  <CheckoutButton
                    planId="lp-light"
                    loginCallbackUrl="/lp/pricing"
                    variant="primary"
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-colors bg-blue-600 hover:bg-blue-700 text-white`}
                  >
                    {plan.cta}
                  </CheckoutButton>
                ) : (
                  <CheckoutButton
                    planId="lp-pro"
                    loginCallbackUrl="/lp/pricing"
                    variant="secondary"
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${colors.ctaColor}`}
                  >
                    {plan.cta}
                  </CheckoutButton>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* 比較表 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-black text-white mb-4 text-center">プラン比較</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">機能</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Free</th>
                  <th className="text-center py-3 px-4 text-blue-400 font-medium">ライト</th>
                  <th className="text-center py-3 px-4 text-cyan-400 font-bold">Pro</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {[
                  ['月の生成回数', '3ページ', '10ページ', '30ページ', '200ページ'],
                  ['デザインテーマ数', '3種類', '5種類', '全8種類', '全8種類+カスタム'],
                  ['構成案パターン', '3パターン', '3パターン', '3パターン', '3パターン'],
                  ['コピーブラッシュアップ', '---', '---', '対応', '対応'],
                  ['HTMLエクスポート', '---', '---', '対応（レスポンシブ）', '対応（レスポンシブ）'],
                  ['PDF構成シート出力', '---', '---', '対応', '対応'],
                  ['Unsplash素材検索', '---', '---', '対応', '対応'],
                  ['生成履歴保存', '7日', '無制限', '無期限', '無期限'],
                  ['チームアカウント', '---', '---', '---', '10名'],
                ].map(([feature, free, light, pro, enterprise]) => (
                  <tr key={feature} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{feature}</td>
                    <td className="py-3 px-4 text-center text-slate-500">{free}</td>
                    <td className="py-3 px-4 text-center text-blue-400">{light}</td>
                    <td className="py-3 px-4 text-center text-cyan-400 font-medium">{pro}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="text-center text-sm text-slate-500">
          <p>ご不明な点は <a href="mailto:info@surisuta.jp" className="text-cyan-400 hover:text-cyan-300">info@surisuta.jp</a> までお問い合わせください。</p>
        </div>
      </div>
    </div>
  )
}
