'use client'

import { motion } from 'framer-motion'
import { Check, X, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

const PLANS = [
  {
    name: 'フリー',
    price: '¥0',
    period: '',
    description: '個人・小規模利用に',
    features: [
      { text: '1日3回までLP生成', included: true },
      { text: 'URLから商品情報自動取得', included: true },
      { text: '3種類のデザインテーマ', included: true },
      { text: 'HTMLダウンロード', included: true },
      { text: 'セクション並べ替え', included: true },
      { text: 'コピーブラッシュアップ', included: false },
      { text: '全8テーマ解放', included: false },
      { text: '生成履歴（無制限）', included: false },
    ],
    cta: '無料で始める',
    href: '/lp/new/input',
    popular: false,
    color: 'border-slate-700 bg-slate-900',
    ctaColor: 'border border-cyan-600 text-cyan-400 hover:bg-cyan-500/10',
  },
  {
    name: 'プロ',
    price: '¥2,980',
    period: '/月（税込）',
    description: 'フリーランス・中小企業に',
    features: [
      { text: '1日30回までLP生成', included: true },
      { text: 'URLから商品情報自動取得', included: true },
      { text: '全8種類のデザインテーマ', included: true },
      { text: 'HTMLダウンロード', included: true },
      { text: 'セクション並べ替え', included: true },
      { text: 'コピーブラッシュアップ', included: true },
      { text: '全8テーマ解放', included: true },
      { text: '生成履歴（無制限）', included: true },
    ],
    cta: 'プロプランを始める',
    href: '/lp/new/input',
    popular: true,
    color: 'border-cyan-500 bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.1)]',
    ctaColor: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black',
  },
  {
    name: 'エンタープライズ',
    price: '¥9,800',
    period: '/月（税込）',
    description: '代理店・制作会社に',
    features: [
      { text: '1日200回までLP生成', included: true },
      { text: 'URLから商品情報自動取得', included: true },
      { text: '全8種類のデザインテーマ', included: true },
      { text: 'HTMLダウンロード', included: true },
      { text: 'セクション並べ替え', included: true },
      { text: 'コピーブラッシュアップ', included: true },
      { text: '全8テーマ解放', included: true },
      { text: '生成履歴（無制限）', included: true },
    ],
    cta: 'エンタープライズを始める',
    href: '/lp/new/input',
    popular: false,
    color: 'border-slate-700 bg-slate-900',
    ctaColor: 'border border-slate-600 text-slate-300 hover:bg-slate-800',
  },
]

export default function LpPricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-4">料金プラン</h1>
          <p className="text-slate-400">AIでLPを自動生成。あなたに合ったプランをお選びください。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border p-7 ${plan.color}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-cyan-500 rounded-full text-xs font-bold text-slate-950">
                  <Zap className="w-3 h-3" />
                  人気
                </div>
              )}

              <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
              <p className="text-slate-500 text-xs mb-4">{plan.description}</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-3xl font-black text-white">{plan.price}</span>
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

              <button
                onClick={() => router.push(plan.href)}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${plan.ctaColor}`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* 比較表 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-black text-white mb-4 text-center">プラン比較</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">機能</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">フリー</th>
                  <th className="text-center py-3 px-4 text-cyan-400 font-bold">プロ</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">エンタープライズ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {[
                  ['1日の生成回数', '3回', '30回', '200回'],
                  ['デザインテーマ数', '3種類', '8種類', '8種類'],
                  ['コピーブラッシュアップ', '✕', '✓', '✓'],
                  ['HTMLダウンロード', '✓', '✓', '✓'],
                  ['URLから商品情報自動取得', '✓', '✓', '✓'],
                  ['生成履歴保存', '30日', '無制限', '無制限'],
                ].map(([feature, free, pro, enterprise]) => (
                  <tr key={feature} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{feature}</td>
                    <td className="py-3 px-4 text-center text-slate-500">{free}</td>
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
