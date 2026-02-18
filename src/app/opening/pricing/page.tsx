'use client'

import { motion } from 'framer-motion'
import { Check, X, Zap } from 'lucide-react'

const PLANS = [
  {
    name: '無料',
    price: '¥0',
    period: '',
    features: [
      { text: '1日3回まで生成', included: true },
      { text: '3種類のテンプレート', included: true },
      { text: 'テキスト編集', included: true },
      { text: 'コードコピー', included: true },
      { text: '履歴保存（7日間）', included: true },
      { text: 'カラー・タイミング編集', included: false },
      { text: 'ZIPダウンロード', included: false },
      { text: '透かしなし', included: false },
    ],
    cta: '無料で試す',
    href: '/opening',
    popular: false,
  },
  {
    name: 'プロ',
    price: '¥2,980',
    period: '/月（税込）',
    features: [
      { text: '1日30回まで生成', included: true },
      { text: '全6テンプレート', included: true },
      { text: 'テキスト編集', included: true },
      { text: 'コードコピー', included: true },
      { text: '履歴保存（無制限）', included: true },
      { text: 'カラー・タイミング編集', included: true },
      { text: 'ZIPダウンロード', included: true },
      { text: '透かしなし', included: true },
    ],
    cta: 'プロプランを始める',
    href: '/opening',
    popular: true,
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-white mb-4">料金プラン</h1>
        <p className="text-white/50">あなたに合ったプランをお選びください</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.name}
            className={`relative rounded-2xl border p-8 ${
              plan.popular
                ? 'border-[#EF4343] bg-[#EF4343]/5 shadow-[0_0_30px_rgba(239,67,67,0.1)]'
                : 'border-white/10 bg-white/5'
            }`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-[#EF4343] rounded-full text-xs font-bold text-white">
                <Zap className="h-3 w-3" />
                人気
              </div>
            )}

            <h3 className="text-2xl font-black text-white mb-1">{plan.name}</h3>
            <div className="flex items-end gap-1 mb-6">
              <span className="text-4xl font-black text-white">{plan.price}</span>
              {plan.period && <span className="text-sm text-white/40 mb-1">{plan.period}</span>}
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  {f.included ? (
                    <Check className="h-4 w-4 text-[#EF4343] flex-shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-white/20 flex-shrink-0" />
                  )}
                  <span className={f.included ? 'text-white/80' : 'text-white/30'}>{f.text}</span>
                </li>
              ))}
            </ul>

            <a
              href={plan.href}
              className={`block w-full py-3 rounded-xl text-center font-bold transition-all ${
                plan.popular
                  ? 'bg-[#EF4343] text-white shadow-lg shadow-[#EF4343]/20 hover:shadow-[#EF4343]/40'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {plan.cta}
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
