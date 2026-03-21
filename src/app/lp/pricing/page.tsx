'use client'

import { motion } from 'framer-motion'
import { Check, X, Zap, CheckCircle2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { LP_PRICING } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

export default function LpPricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.lpPlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="min-h-screen bg-lp-bg text-white relative">
      {/* 背景グラデーションオーブ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-lp-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-lp-primary/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">料金プラン</h1>
          <p className="text-slate-400">AIでLPを自動生成。あなたに合ったプランをお選びください。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {LP_PRICING.plans.map((plan, i) => {
            const isCurrent =
              (plan.id === 'lp-free' && (currentPlan === 'FREE' || currentPlan === 'GUEST')) ||
              (plan.id === 'lp-light' && currentPlan === 'LIGHT') ||
              (plan.id === 'lp-pro' && currentPlan === 'PRO') ||
              (plan.id === 'lp-enterprise' && currentPlan === 'ENTERPRISE')
            const isPopular = plan.popular && !isCurrent
            const isPro = plan.id === 'lp-pro'

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col gap-6 rounded-xl p-6 transition-all ${
                  isPro
                    ? 'border-2 border-lp-primary bg-lp-primary/10 shadow-[0_0_40px_-10px_rgba(5,183,214,0.3)] lg:-translate-y-4'
                    : 'border border-lp-primary/20 bg-lp-primary/5 hover:border-lp-primary/40'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-lp-primary text-lp-bg text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Popular
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                      現在のプラン
                    </span>
                  </div>
                )}

                <div>
                  <h3 className={`text-lg font-bold uppercase tracking-widest mb-1 ${isPro ? 'text-lp-primary' : 'opacity-80'}`}>{plan.name}</h3>
                  <p className="text-slate-500 text-xs">{plan.description}</p>
                </div>

                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black tracking-tighter text-white">{plan.priceLabel}</span>
                  {plan.period && <span className="text-sm font-medium opacity-60 mb-1">{plan.period}</span>}
                </div>

                <div className="space-y-3 flex-1">
                  {plan.features.map((f, j) => (
                    <div key={j} className="text-sm flex gap-3 items-center">
                      {f.included ? (
                        <CheckCircle2 className="w-4 h-4 text-lp-primary flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-700 flex-shrink-0" />
                      )}
                      <span className={f.included ? 'text-slate-300' : 'text-slate-600'}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-center text-sm font-bold text-emerald-300 border border-emerald-700/40 bg-emerald-900/20">
                    利用中
                  </div>
                ) : plan.id === 'lp-free' ? (
                  <Link
                    href="/lp/new/input"
                    className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-all bg-lp-primary/20 hover:bg-lp-primary/30 text-lp-primary"
                  >
                    {plan.cta}
                  </Link>
                ) : plan.id === 'lp-enterprise' ? (
                  <a
                    href="mailto:k-mitsumori@surisuta.jp?subject=ドヤワイヤーフレーム AI Enterprise問い合わせ"
                    className="block w-full py-3 rounded-xl text-sm font-bold text-center transition-all border border-lp-border text-slate-300 hover:bg-lp-surface"
                  >
                    {plan.cta}
                  </a>
                ) : plan.id === 'lp-light' ? (
                  <CheckoutButton
                    planId="lp-light"
                    loginCallbackUrl="/lp/pricing"
                    variant="primary"
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {plan.cta}
                  </CheckoutButton>
                ) : (
                  <CheckoutButton
                    planId="lp-pro"
                    loginCallbackUrl="/lp/pricing"
                    variant="secondary"
                    className={`w-full py-3 rounded-xl text-sm font-black transition-all bg-lp-primary hover:bg-lp-primary/90 text-lp-bg shadow-lg shadow-lp-primary/20`}
                  >
                    {plan.cta}
                  </CheckoutButton>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* 比較表 */}
        <div className="bg-lp-surface border border-lp-border rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-black text-white mb-4 text-center">プラン比較</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-lp-border">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">機能</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Free</th>
                  <th className="text-center py-3 px-4 text-blue-400 font-medium">ライト</th>
                  <th className="text-center py-3 px-4 text-lp-primary font-bold">Pro</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['月の生成回数', '3ページ', '10ページ', '30ページ', '200ページ'],
                  ['デザインテーマ数', '3種類', '5種類', '全8種類', '全8種類+カスタム'],
                  ['構成案パターン', '3パターン', '3パターン', '3パターン', '3パターン'],
                  ['コピーブラッシュアップ', '---', '---', '対応', '対応'],
                  ['HTMLエクスポート', '---', '---', '対応（レスポンシブ）', '対応（レスポンシブ）'],
                  ['PDF構成シート出力', '---', '---', 'Coming Soon', 'Coming Soon'],
                  ['Unsplash素材検索', '---', '---', 'Coming Soon', 'Coming Soon'],
                  ['生成履歴保存', '7日', '無制限', '無期限', '無期限'],
                  ['チームアカウント', '---', '---', '---', '10名'],
                ].map(([feature, free, light, pro, enterprise]) => (
                  <tr key={feature} className="border-b border-lp-primary/5 hover:bg-lp-primary/5 transition-colors">
                    <td className="py-4 px-4 text-slate-400 font-medium">{feature}</td>
                    <td className="py-4 px-4 text-center text-slate-500">{free}</td>
                    <td className="py-4 px-4 text-center text-blue-400">{light}</td>
                    <td className="py-4 px-4 text-center text-lp-primary font-bold">{pro}</td>
                    <td className="py-4 px-4 text-center text-slate-400">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="bg-lp-primary/5 border border-lp-primary/10 rounded-xl p-8 text-center max-w-4xl mx-auto">
          <p className="text-white font-bold mb-2">ご不明な点はお気軽にどうぞ</p>
          <p className="text-sm text-slate-500 mb-4">プランの詳細やカスタム対応についてご相談ください。</p>
          <a
            href="mailto:info@surisuta.jp"
            className="inline-flex items-center gap-2 bg-lp-primary/20 hover:bg-lp-primary/30 text-lp-primary px-6 py-3 rounded-lg font-bold transition-all text-sm"
          >
            メールで相談する
          </a>
        </div>
      </div>
    </div>
  )
}
