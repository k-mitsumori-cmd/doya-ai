'use client'

import { useSession } from 'next-auth/react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { VOICE_PRICING } from '@/lib/pricing'
import Link from 'next/link'

function planTierFrom(plan: string): 'free' | 'pro' | 'enterprise' {
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return 'enterprise'
  if (['PRO', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)) return 'pro'
  return 'free'
}

export default function VoicePricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const rawPlan = user?.voicePlan || user?.plan || 'FREE'
  const currentTier = planTierFrom(rawPlan)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-black text-slate-900">ドヤボイスAI 料金プラン</h1>
        <p className="text-slate-500 mt-2">
          1アカウントで全サービス利用可能。どれか1つProに契約すると全サービスのPro機能が解放されます。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {VOICE_PRICING.plans.map(plan => {
          const tierMap: Record<string, 'free' | 'pro' | 'enterprise'> = {
            'voice-free': 'free',
            'voice-pro': 'pro',
            'voice-enterprise': 'enterprise',
          }
          const tier = tierMap[plan.id] ?? 'free'
          const isCurrent = currentTier === tier
          const isPopular = plan.popular

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                isPopular
                  ? 'border-violet-500 shadow-xl shadow-violet-500/20 scale-105'
                  : isCurrent
                  ? 'border-green-400 bg-green-50/50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
                  人気No.1
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
                  現在のプラン
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-900">{plan.name}</h2>
                <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">{plan.priceLabel}</span>
                {plan.period && <span className="text-slate-500 ml-1">{plan.period}</span>}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => {
                  const included = typeof feature === 'object' ? feature.included : true
                  const text = typeof feature === 'object' ? feature.text : feature
                  return (
                    <li key={i} className="flex items-start gap-2">
                      {included ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${included ? 'text-slate-700' : 'text-slate-400'}`}>
                        {text}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div>
                {tier === 'free' ? (
                  <Link
                    href={session ? '/voice/new' : '/auth/signin'}
                    className="block w-full py-3 text-center font-black rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                  >
                    {plan.cta}
                  </Link>
                ) : tier === 'enterprise' ? (
                  <a
                    href="mailto:support@surisuta.jp"
                    className="block w-full py-3 text-center font-black rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href="/pricing"
                    className="block w-full py-3 text-center font-black rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors text-sm shadow-lg shadow-violet-500/25"
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-violet-800">
          💡 Proプランに契約すると、ドヤボイスAIだけでなく全サービス（ドヤバナーAI・ドヤ記事作成・ドヤインタビュー等）のPro機能が同時に解放されます。
        </p>
      </div>
    </div>
  )
}
