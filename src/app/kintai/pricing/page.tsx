'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KINTAI_PRICING } from '@/lib/pricing'

export default function KintaiPricingPage() {
  const [userPlan, setUserPlan] = useState<string>('FREE')
  useEffect(() => {
    fetch('/api/kintai/usage').then(r => r.json()).then(d => setUserPlan(d.plan || 'FREE')).catch(() => {})
  }, [])

  const getPlanLevel = (planId: string) => {
    if (planId.includes('enterprise')) return 4
    if (planId.includes('pro')) return 3
    if (planId.includes('starter')) return 2
    return 1
  }
  const userLevel = getPlanLevel(userPlan.toLowerCase())

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">

      <div className="p-6 lg:p-10 max-w-6xl mx-auto relative">
        {/* Floating bears */}
        <img
          src="/kintai/characters/thumbsup_いいね.png"
          alt=""
          className="bear-float hidden lg:block absolute -left-4 top-40 opacity-40"
          style={{ width: 80, height: 80, objectFit: 'contain' }}
        />
        <img
          src="/kintai/characters/jump_大喜び.png"
          alt=""
          className="bear-float-2 hidden lg:block absolute -right-4 top-96 opacity-40"
          style={{ width: 70, height: 70, objectFit: 'contain' }}
        />

        {/* Header */}
        <div className="text-center mb-12 pricing-fade-in">
          <img
            src="/kintai/characters/present_プレゼン.png"
            alt="プレゼンするクマ"
            className="bear-float mx-auto mb-4"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 mb-3">
            ドヤ勤怠 料金プラン
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto text-base">
            チームの成長に合わせて最適なプランを選択できます。
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-gradient-to-r from-[#7f19e6]/10 to-violet-100 rounded-full">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              celebration
            </span>
            <span className="text-sm font-bold text-[#7f19e6]">
              従業員5名まで永久無料
            </span>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {KINTAI_PRICING.plans.map((plan, i) => (
            <div
              key={plan.id}
              className={`pricing-fade-in-${i + 1} relative bg-white rounded-3xl p-6 ${
                plan.popular
                  ? 'shadow-2xl ring-2 ring-purple-500'
                  : plan.price === 0
                    ? 'shadow-lg ring-2 ring-emerald-200'
                    : 'shadow-lg'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="badge-pulse absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#7f19e6] text-white text-xs font-bold rounded-full shadow-lg shadow-[#7f19e6]/25">
                  人気
                </div>
              )}

              {/* Free badge */}
              {plan.price === 0 && plan.id === 'kintai-free' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                  永久無料
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
                      style={feature.included ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {feature.included ? 'check_circle' : 'cancel'}
                    </span>
                    <span className={`text-sm ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {(() => {
                const planLevel = getPlanLevel(plan.id)
                const isCurrent = planLevel === userLevel
                const isLower = planLevel < userLevel
                const isEnterprise = plan.id === 'kintai-enterprise'

                const label = isCurrent
                  ? '現在のプラン'
                  : isLower
                    ? plan.name
                    : isEnterprise
                      ? 'お問い合わせ'
                      : 'アップグレード'

                const href = isCurrent || isLower
                  ? '/kintai/dashboard'
                  : isEnterprise
                    ? 'https://doyamarke.surisuta.jp/contact'
                    : '/kintai/dashboard'

                const disabled = isCurrent || isLower

                return disabled ? (
                  <span
                    className={`block w-full py-3 text-center text-base font-bold rounded-full ${
                      isCurrent
                        ? 'bg-[#7f19e6]/10 text-[#7f19e6] ring-2 ring-[#7f19e6]/30'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isCurrent && <span className="mr-1">✅</span>}
                    {label}
                  </span>
                ) : (
                  <Link
                    href={href}
                    className={`block w-full py-3 text-center text-base font-bold rounded-full transition-all ${
                      plan.popular
                        ? 'bg-[#7f19e6] text-white shadow-md hover:shadow-lg hover:bg-[#6b14c4]'
                        : isEnterprise
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })()}
            </div>
          ))}
        </div>

        {/* Trial notice */}
        <div className="text-center mb-8">
          <p className="text-sm text-slate-500">
            <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
            全プラン14日間の無料トライアル付き（クレジットカード不要）
          </p>
        </div>

        {/* CTA section */}
        <div className="bg-white rounded-3xl shadow-lg p-8 text-center pricing-fade-in-4">
          <img
            src="/kintai/characters/hello_挨拶.png"
            alt="挨拶するクマ"
            className="bear-float-2 mx-auto mb-4"
            style={{ width: 100, height: 100, objectFit: 'contain' }}
          />
          <h3 className="text-xl font-black text-slate-900 mb-2">まずは無料で始めてみませんか？</h3>
          <p className="text-base text-slate-600 mb-6 max-w-lg mx-auto">
            クレジットカード不要、従業員5名までの勤怠管理が永久無料でお使いいただけます。
            アップグレードはいつでも可能です。
          </p>
          <Link
            href="/kintai/dashboard"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[#7f19e6] text-white rounded-full text-base font-bold shadow-lg shadow-[#7f19e6]/25 hover:shadow-xl hover:bg-[#6b14c4] transition-all"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            無料で始める
          </Link>
        </div>
      </div>
    </div>
  )
}
