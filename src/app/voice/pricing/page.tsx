'use client'

import { useSession } from 'next-auth/react'
import { CheckCircle2 } from 'lucide-react'
import { VOICE_PRICING } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import Link from 'next/link'

function planTierFrom(plan: string): 'free' | 'light' | 'pro' | 'enterprise' {
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return 'enterprise'
  if (['PRO', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)) return 'pro'
  if (p === 'LIGHT') return 'light'
  return 'free'
}

const COMPARISON_ROWS = [
  { label: '月間生成回数', free: '3回', light: '30回', pro: '100回' },
  { label: '利用可能キャラクター', free: '4体', light: '4体', pro: '12体' },
  { label: '最大入力文字数', free: '1,000文字', light: '3,000文字', pro: '5,000文字' },
  { label: '書き出し形式', free: 'MP3', light: 'MP3', pro: 'WAV / MP3' },
  { label: '録音スタジオ機能', free: null, light: null, pro: true },
  { label: 'カスタマーサポート', free: '通常', light: '通常', pro: '優先対応' },
]

export default function VoicePricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const rawPlan = user?.voicePlan || user?.plan || 'FREE'
  const currentTier = planTierFrom(rawPlan)

  // First 3 plans for the main grid (Free, Light, Pro)
  const mainPlans = VOICE_PRICING.plans.slice(0, 3)
  // Enterprise plan shown separately if it exists
  const enterprisePlan = VOICE_PRICING.plans.find(p => p.id === 'voice-enterprise')

  const tierMap: Record<string, 'free' | 'light' | 'pro' | 'enterprise'> = {
    'voice-free': 'free',
    'voice-light': 'light',
    'voice-pro': 'pro',
    'voice-enterprise': 'enterprise',
  }

  return (
    <div className="flex flex-col max-w-[1200px] w-full mx-auto px-6 md:px-10 py-12 md:py-20">
      {/* ===== Page Title ===== */}
      <div className="flex flex-col gap-4 text-center mb-16">
        <h1 className="text-slate-900 text-4xl md:text-5xl font-black leading-tight tracking-tight">
          料金プラン
        </h1>
        <p className="text-slate-600 text-lg">
          用途に合わせて最適なプランをお選びください
        </p>
      </div>

      {/* ===== Pricing Cards (3-column) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        {mainPlans.map(plan => {
          const tier = tierMap[plan.id] ?? 'free'
          const isCurrent = currentTier === tier
          const isPro = tier === 'pro'

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col gap-8 rounded-2xl p-8 transition-transform hover:translate-y-[-4px] ${
                isPro
                  ? 'border-2 border-primary bg-primary/5 shadow-2xl shadow-primary/20'
                  : 'border border-primary/10 bg-white'
              }`}
            >
              {/* PRO badge */}
              {isPro && !isCurrent && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold py-1 px-4 rounded-full flex items-center gap-1 whitespace-nowrap">
                  <span className="text-sm">&#x2605;</span> おすすめ
                </div>
              )}
              {/* Current plan badge */}
              {isCurrent && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold py-1 px-4 rounded-full whitespace-nowrap">
                  現在のプラン
                </div>
              )}

              {/* Plan name + Price */}
              <div className="flex flex-col gap-2">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${
                  isPro ? 'text-primary' : 'text-slate-500'
                }`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 text-slate-900">
                  <span className="text-5xl font-black tracking-tight">
                    {plan.priceLabel}
                  </span>
                  {plan.period && (
                    <span className="text-lg font-medium opacity-60">/月</span>
                  )}
                </div>
              </div>

              {/* CTA Button (positioned after price, before features - Stitch layout) */}
              <div>
                {isCurrent ? (
                  <div className="flex w-full cursor-default items-center justify-center rounded-xl h-12 px-4 bg-slate-100 text-slate-500 text-sm font-bold">
                    利用中
                  </div>
                ) : tier === 'free' ? (
                  <Link
                    href={session ? '/voice/new' : '/auth/signin'}
                    className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 px-4 bg-slate-100 text-slate-500 text-sm font-bold hover:bg-slate-200 transition-colors"
                  >
                    {plan.cta}
                  </Link>
                ) : tier === 'light' ? (
                  <CheckoutButton
                    planId="voice-light"
                    loginCallbackUrl="/voice/pricing"
                    variant="primary"
                    className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 px-4 border-2 border-primary text-primary hover:bg-primary/5 transition-colors text-sm font-bold"
                  >
                    {plan.cta}
                  </CheckoutButton>
                ) : (
                  <CheckoutButton
                    planId="voice-pro"
                    loginCallbackUrl="/voice/pricing"
                    variant="secondary"
                    className="flex w-full cursor-pointer items-center justify-center rounded-xl h-12 px-4 bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/30 transition-all text-sm font-bold"
                  >
                    {plan.cta}
                  </CheckoutButton>
                )}
              </div>

              {/* Features */}
              <div className="flex flex-col gap-4">
                {plan.features.map((feature, i) => {
                  const included = typeof feature === 'object' ? feature.included : true
                  const text = typeof feature === 'object' ? feature.text : feature
                  if (!included) return null
                  return (
                    <div key={i} className="flex gap-3 items-center text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className={`text-sm ${isPro && (i === 0 || i === 3) ? 'font-bold' : ''}`}>{text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== Enterprise plan (separate) ===== */}
      {enterprisePlan && (
        <div className="rounded-2xl border border-primary/10 bg-white p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-24">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
              {enterprisePlan.name}
            </p>
            <p className="text-slate-700 font-bold text-lg">{enterprisePlan.description}</p>
            <p className="text-slate-500 text-sm mt-1">
              月1,000回生成 / カスタムボイス / API連携 / チームアカウント
            </p>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div>
              <span className="text-3xl font-black tracking-tight text-slate-900">
                {enterprisePlan.priceLabel}
              </span>
              <span className="text-slate-500 text-sm ml-1">/月</span>
            </div>
            {currentTier === 'enterprise' ? (
              <div className="flex items-center justify-center h-12 px-6 font-bold rounded-xl text-sm bg-slate-100 text-slate-500 cursor-default">
                利用中
              </div>
            ) : (
              <a
                href="mailto:k-mitsumori@surisuta.jp?subject=ドヤボイスAI Enterprise問い合わせ"
                className="flex items-center justify-center h-12 px-6 font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-sm whitespace-nowrap"
              >
                {enterprisePlan.cta}
              </a>
            )}
          </div>
        </div>
      )}

      {/* ===== Comparison Table ===== */}
      <div className="flex flex-col gap-8">
        <h2 className="text-slate-900 text-2xl font-bold tracking-tight px-2">
          機能比較表
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-5 text-sm font-bold text-slate-900 min-w-[200px]">
                  機能
                </th>
                <th className="px-6 py-5 text-sm font-bold text-slate-900">
                  FREE
                </th>
                <th className="px-6 py-5 text-sm font-bold text-primary/80">
                  LIGHT
                </th>
                <th className="px-6 py-5 text-sm font-bold text-primary">
                  PRO
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={i}>
                  <td className="px-6 py-5 text-sm text-slate-600 font-medium">
                    {row.label}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    {row.free === null ? (
                      <span className="text-slate-300">&mdash;</span>
                    ) : (
                      row.free
                    )}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">
                    {row.light === null ? (
                      <span className="text-slate-300">&mdash;</span>
                    ) : (
                      row.light
                    )}
                  </td>
                  <td className={`px-6 py-5 text-sm ${row.pro === true ? 'text-primary' : 'font-bold text-slate-900'}`}>
                    {row.pro === true ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : row.pro === null ? (
                      <span className="text-slate-300">&mdash;</span>
                    ) : (
                      row.pro
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Bottom Banner ===== */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 text-center mt-16">
        <p className="text-sm font-bold text-primary">
          Proプランに契約すると、ドヤボイスAIだけでなく全サービス（ドヤバナーAI・ドヤ記事作成・ドヤインタビュー等）のPro機能が同時に解放されます。
        </p>
      </div>
    </div>
  )
}
