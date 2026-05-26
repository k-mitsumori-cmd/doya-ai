'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { HR_PRICING } from '@/lib/pricing'

export default function HrPricingPage() {
  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-black text-slate-900 mb-3">料金プラン</h1>
          <p className="text-slate-500 max-w-lg mx-auto">
            5名までは永久無料。チームの成長に合わせて最適なプランを選択できます。
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {HR_PRICING.plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-white rounded-2xl border-2 p-6 ${
                plan.popular ? 'border-blue-500 shadow-xl shadow-blue-500/10' : 'border-slate-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                  おすすめ
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-black text-slate-900">{plan.name}</h2>
                <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">{plan.priceLabel}</span>
                {plan.period && (
                  <span className="text-sm text-slate-500 ml-1">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2">
                    <span
                      className={`material-symbols-outlined text-lg mt-0.5 flex-shrink-0 ${
                        feature.included ? 'text-emerald-500' : 'text-slate-300'
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {feature.included ? 'check_circle' : 'cancel'}
                    </span>
                    <span className={`text-base ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.price === 0 && plan.id !== 'hr-enterprise' ? '/hr/dashboard' : '#'}
                className={`block w-full py-3 text-center text-base font-bold rounded-xl transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg hover:shadow-sky-500/20'
                    : plan.id === 'hr-enterprise'
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* FAQ or extra info */}
        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-black text-slate-900 mb-2">まずは無料で始めてみませんか？</h3>
          <p className="text-base text-slate-600 mb-6 max-w-lg mx-auto">
            クレジットカード不要、5名までの従業員管理が永久無料でお使いいただけます。
            アップグレードはいつでも可能です。
          </p>
          <Link
            href="/hr/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-base font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            無料で始める
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
