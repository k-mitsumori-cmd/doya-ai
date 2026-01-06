'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { PERSONA_PRICING, getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import { CheckCircle2, Crown, Timer, Zap } from 'lucide-react'

function tierFrom(raw: any) {
  const p = String(raw || '').toUpperCase()
  if (!p || p === 'GUEST') return 'GUEST' as const
  if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
  if (p.includes('PRO')) return 'PRO' as const
  return 'FREE' as const
}

export default function PersonaPricingPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const planRaw = String((session?.user as any)?.personaPlan || (session?.user as any)?.plan || (isLoggedIn ? 'FREE' : 'GUEST')).toUpperCase()
  const tier = tierFrom(planRaw)
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))

  useEffect(() => {
    if (!isFreeHourActive) return
    const t = window.setInterval(() => setFreeHourRemainingMs(getFreeHourRemainingMs(firstLoginAt)), 1000)
    return () => window.clearInterval(t)
  }, [isFreeHourActive, firstLoginAt])

  const tierLabel = tier === 'GUEST' ? 'ゲスト' : tier === 'FREE' ? '無料' : tier === 'PRO' ? 'PRO' : 'Enterprise'

  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const plans = PERSONA_PRICING.plans
  const free = plans.find((p) => p.id === 'persona-free')
  const pro = plans.find((p) => p.id === 'persona-pro')
  const enterprise = plans.find((p) => p.id === 'persona-enterprise')

  const trialHint = useMemo(() => {
    if (!isLoggedIn) return null
    if (!isFreeHourActive) return null
    return (
      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-purple-900">初回ログイン後1時間は、全機能が解放（※PDF除く）</p>
              <div className="px-2.5 py-1 rounded-full bg-white border border-purple-200 text-purple-800 text-xs font-black tabular-nums flex-shrink-0">
                残り {formatRemainingTime(freeHourRemainingMs)}
              </div>
            </div>
            <p className="mt-1 text-[11px] font-bold text-purple-800/80">
              スケジュール画像・日記画像なども使えます（PDFはPRO/Enterpriseのみ）。
            </p>
          </div>
        </div>
      </div>
    )
  }, [isLoggedIn, isFreeHourActive, freeHourRemainingMs])

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-6 flex items-center justify-center gap-3">
        <Link
          href="/persona"
          className="text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-2 rounded-full"
        >
          ドヤペルソナAIに戻る
        </Link>
        {tier !== 'GUEST' && (
          <Link href="/api/stripe/portal?returnTo=/persona/pricing" className="text-xs font-black text-purple-600 hover:text-purple-700">
            プラン管理
          </Link>
        )}
      </div>

      <main className="max-w-[720px] mx-auto px-6 pb-12">
        <h1 className="text-center text-3xl sm:text-4xl font-black text-slate-900 mt-6 mb-10">
          ドヤペルソナAI 料金プラン
        </h1>

        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-sm font-black text-slate-800">現在のプラン：{tierLabel}</p>
          {trialHint}
        </div>

        <div className="space-y-6">
          {/* FREE */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{free?.name || 'おためし'}</h2>
                <p className="text-sm text-slate-600 mt-2">
                  ゲスト：{PERSONA_PRICING.guestLimit}回まで（画像/PDFはブラインド）
                  <br />
                  ログイン：1時間だけ全解放（※PDF除く）/ 以降は{PERSONA_PRICING.freeLimit}回まで（画像ブラインド）
                </p>
                <div className="mt-5">
                  {tier === 'FREE' ? (
                    <button disabled className="px-4 py-2 rounded-full bg-slate-200 text-slate-600 font-black text-sm cursor-not-allowed">
                      現在のプラン
                    </button>
                  ) : (
                    <Link href="/persona">
                      <button className="px-4 py-2 rounded-full bg-purple-600 text-white font-black text-sm hover:bg-purple-700 transition-colors">
                        {free?.cta || '無料で試す'}
                      </button>
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-2xl">{free?.priceLabel || '無料'}</div>
              </div>
            </div>
          </div>

          {/* PRO */}
          <div className="rounded-3xl bg-slate-900 p-8 text-white">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/70">
                  <Crown className="w-4 h-4 text-purple-300" />
                  PRO
                </div>
                <h2 className="text-2xl font-black mt-2">{pro?.name || 'プロ'}</h2>
                <p className="text-sm text-white/80 mt-2">1日{PERSONA_PRICING.proLimit}回まで。画像生成・PDFも含めて全機能が解放されます。</p>
                <ul className="mt-5 space-y-2 text-sm font-bold text-white/90">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-300" /> 1日{PERSONA_PRICING.proLimit}回まで生成</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-300" /> スケジュール画像 / 日記画像</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-300" /> PDFダウンロード</li>
                </ul>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xl">
                  {pro?.priceLabel || '月額 ¥9,980'}{pro?.period || ''}
                </div>
              </div>
            </div>
            <div className="mt-6">
              {tier === 'PRO' ? (
                <button disabled className="w-full py-4 rounded-2xl text-base font-black bg-white/10 text-white/70 cursor-not-allowed">
                  現在のプラン
                </button>
              ) : tier === 'ENTERPRISE' ? (
                <button disabled className="w-full py-4 rounded-2xl text-base font-black bg-white/10 text-white/70 cursor-not-allowed">
                  Enterpriseをご利用中
                </button>
              ) : (
                <CheckoutButton planId="persona-pro" loginCallbackUrl="/persona/pricing" className="w-full py-4 rounded-2xl text-base" variant="primary">
                  プロプランを始める
                </CheckoutButton>
              )}
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl bg-[#0B1220] p-8 text-white border border-white/10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/70">
                  <Zap className="w-4 h-4 text-amber-300" />
                  ENTERPRISE
                </div>
                <h2 className="text-2xl font-black mt-2">{enterprise?.name || 'エンタープライズ'}</h2>
                <p className="text-sm text-white/80 mt-2">1日{PERSONA_PRICING.enterpriseLimit || 30}回まで。大量運用向け。</p>
                <ul className="mt-5 space-y-2 text-sm font-bold text-white/90">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-300" /> 1日{PERSONA_PRICING.enterpriseLimit || 30}回まで生成</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-300" /> 全機能（画像/PDF）</li>
                </ul>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xl">
                  {enterprise?.priceLabel || '月額 ¥49,800'}{enterprise?.period || ''}
                </div>
              </div>
            </div>
            <div className="mt-6">
              {tier === 'ENTERPRISE' ? (
                <button disabled className="w-full py-4 rounded-2xl text-base font-black bg-white/10 text-white/70 cursor-not-allowed">
                  現在のプラン
                </button>
              ) : (
                <CheckoutButton
                  planId="persona-enterprise"
                  loginCallbackUrl="/persona/pricing"
                  className="w-full py-4 rounded-2xl text-base"
                  variant="primary"
                >
                  エンタープライズを始める
                </CheckoutButton>
              )}
              <p className="mt-3 text-[11px] font-bold text-white/60">
                ※決済（Stripe）のPrice IDは環境変数で設定してください（persona専用）。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


