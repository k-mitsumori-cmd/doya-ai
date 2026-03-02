'use client'
// ============================================
// ドヤムービーAI - 料金プラン
// ============================================
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { MOVIE_PRICING } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

export default function MoviePricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.moviePlan || user?.plan || 'FREE').toUpperCase()

  const planColors: Record<string, { border: string; bg: string; badge: string }> = {
    free: {
      border: 'border-slate-700',
      bg: 'bg-slate-900/60',
      badge: 'bg-slate-800 text-slate-300',
    },
    'movie-pro': {
      border: 'border-rose-500/60',
      bg: 'bg-gradient-to-b from-rose-950/60 to-slate-900/60',
      badge: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white',
    },
    'movie-enterprise': {
      border: 'border-slate-600',
      bg: 'bg-slate-900/60',
      badge: 'bg-slate-700 text-slate-200',
    },
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-white mb-3">料金プラン</h1>
        <p className="text-rose-200/60">月3本まで無料。本格的な動画制作はProプランで。</p>
      </div>

      {/* プランカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {MOVIE_PRICING.plans.map((plan, i) => {
          const colors = planColors[plan.id] || planColors.free
          const isPro = plan.id === 'movie-pro'
          const isCurrent = (plan.id === 'free' && (currentPlan === 'FREE' || currentPlan === 'GUEST')) ||
                            (plan.id === 'movie-pro' && currentPlan === 'PRO') ||
                            (plan.id === 'movie-enterprise' && currentPlan === 'ENTERPRISE')

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border p-6 ${colors.border} ${colors.bg}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-lg shadow-rose-500/30">
                    人気 No.1
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    現在のプラン
                  </span>
                </div>
              )}

              {/* プラン名・価格 */}
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 ${colors.badge}`}>
                {plan.name}
              </div>
              <div className="mb-1">
                <span className="text-4xl font-black text-white">{plan.priceLabel}</span>
                <span className="text-rose-300/60 ml-1">{plan.period}</span>
              </div>
              <p className="text-rose-200/60 text-sm mb-6">{plan.description}</p>

              {/* 機能リスト */}
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm">
                    <span className={`flex-shrink-0 mt-0.5 ${f.included ? 'text-rose-400' : 'text-slate-600'}`}>
                      {f.included ? '✓' : '×'}
                    </span>
                    <span className={f.included ? 'text-rose-100' : 'text-slate-500 line-through'}>
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
              ) : plan.id === 'free' ? (
                <Link
                  href="/movie/new/concept"
                  className="block w-full py-3 rounded-xl text-center text-sm font-bold text-white border border-slate-600 hover:bg-slate-800/60 transition-all"
                >
                  {plan.cta}
                </Link>
              ) : plan.id === 'movie-enterprise' ? (
                <Link
                  href="mailto:k-mitsumori@surisuta.jp?subject=ドヤムービーAI Enterprise問い合わせ"
                  className="block w-full py-3 rounded-xl text-center text-sm font-bold text-slate-300 border border-slate-600 hover:bg-slate-800/60 transition-all"
                >
                  {plan.cta}
                </Link>
              ) : (
                <CheckoutButton
                  planId={plan.id}
                  loginCallbackUrl="/movie/pricing"
                  variant="secondary"
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all [background:linear-gradient(135deg,#f43f5e,#ec4899)] hover:opacity-90"
                >
                  {plan.cta}
                </CheckoutButton>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* 比較表 */}
      <div className="mb-12">
        <h2 className="text-white font-bold text-lg text-center mb-6">プラン比較</h2>
        <div className="rounded-2xl border border-rose-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rose-900/30 bg-rose-950/30">
                <th className="text-left p-4 text-rose-200/70 font-bold">機能</th>
                <th className="text-center p-4 text-rose-200/70 font-bold">Free</th>
                <th className="text-center p-4 text-rose-300 font-black">Pro</th>
                <th className="text-center p-4 text-rose-200/70 font-bold">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['月間生成数', '3本', '30本', '200本'],
                ['動画画質', 'SD (720p)', 'HD (1080p)', 'HD (1080p)'],
                ['最大尺', '15秒', '60秒', '60秒'],
                ['テンプレート', '3種', '全テンプレート', '全テンプレート+カスタム'],
                ['BGM', '3種', '12種', '12種'],
                ['透かし', 'あり', 'なし', 'なし'],
                ['出力形式', 'MP4', 'MP4 / GIF', 'MP4 / GIF'],
                ['保存期間', '7日間', '無期限', '無期限'],
                ['APIアクセス', '×', '×', '✓'],
                ['チームアカウント', '×', '×', '10名'],
              ].map(([feature, free, pro, enterprise], i) => (
                <tr key={i} className={`border-b border-rose-900/20 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                  <td className="p-4 text-rose-100/70">{feature}</td>
                  <td className="p-4 text-center text-slate-400">{free}</td>
                  <td className="p-4 text-center text-rose-200 font-semibold bg-rose-950/20">{pro}</td>
                  <td className="p-4 text-center text-slate-400">{enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-rose-200/60 text-sm mb-4">
          ご不明な点は{' '}
          <Link href="/movie/guide" className="text-rose-400 hover:text-rose-300 underline">
            使い方ガイド
          </Link>
          をご確認ください。
        </p>
      </div>
    </div>
  )
}
