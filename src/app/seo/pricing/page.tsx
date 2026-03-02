'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { SEO_PRICING, getFreeHourRemainingMs, isWithinFreeHour } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import SeoCancelScheduleNotice from '@/components/SeoCancelScheduleNotice'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Timer, Crown, Building2, CheckCircle2, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function planTierFrom(raw: any) {
  const p = String(raw || '').toUpperCase()
  if (!p || p === 'GUEST') return 'GUEST' as const
  if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
  if (p.includes('PRO')) return 'PRO' as const
  return 'FREE' as const
}

export default function SeoPricingPage() {
  const { data: session } = useSession()
  const seoPlanRaw = String((session?.user as any)?.seoPlan || (session ? 'FREE' : 'GUEST')).toUpperCase()
  const tier = planTierFrom(seoPlanRaw)
  const isLoggedIn = !!session?.user?.email
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))

  const plans = SEO_PRICING.plans
  const free = plans.find((p) => p.id === 'seo-free')
  const pro = plans.find((p) => p.id === 'seo-pro')
  const enterprise = plans.find((p) => p.id === 'seo-enterprise')

  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [welcomePlan, setWelcomePlan] = useState<string>('')

  useEffect(() => {
    // /api/stripe/checkout の success_url に合わせて、成功時にリッチな歓迎モーダルを出す
    const url = new URL(window.location.href)
    const ok = url.searchParams.get('success') === 'true'
    const plan = String(url.searchParams.get('plan') || '')
    if (!ok) return
    if (!plan) return
    const key = `doyaSeo.welcome.shown.${plan}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // ignore
    }
    setWelcomePlan(plan)
    setWelcomeOpen(true)
  }, [])

  const tierLabel = tier === 'GUEST' ? 'ゲスト' : tier === 'FREE' ? '無料' : tier === 'PRO' ? 'PRO' : 'Enterprise'

  useEffect(() => {
    if (!isFreeHourActive) return
    const interval = setInterval(() => {
      setFreeHourRemainingMs(getFreeHourRemainingMs(firstLoginAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])

  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const trialHint = useMemo(() => {
    if (!isLoggedIn) return null
    if (!isFreeHourActive) return null
    const total = 60 * 60 * 1000
    const ratio = Math.max(0, Math.min(1, freeHourRemainingMs / total))
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-blue-900">初回ログイン後1時間は、PRO相当で使い放題（トライアル）</p>
              <div className="px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-800 text-xs font-black tabular-nums flex-shrink-0">
                残り {formatRemainingTime(freeHourRemainingMs)}
              </div>
            </div>
            <p className="mt-1 text-[11px] font-bold text-blue-800/80">
              画像生成や自動修正も解放されます。使えるようになった瞬間は画面に演出が出ます。
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-200/60 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    )
  }, [isLoggedIn, isFreeHourActive, freeHourRemainingMs])

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-6 flex items-center justify-center gap-3">
        <Link
          href="/seo"
          className="text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-2 rounded-full"
        >
          生成記事一覧に戻る
        </Link>
        <Link href="/seo/dashboard/plan" className="text-xs font-black text-blue-600 hover:text-blue-700">
          プラン管理
        </Link>
      </div>

      <main className="max-w-[720px] mx-auto px-6 pb-12">
        <h1 className="text-center text-3xl sm:text-4xl font-black text-slate-900 mt-6 mb-10">
          ドヤライティングAI 料金プラン
        </h1>

        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-sm font-black text-slate-800">現在のプラン：{tierLabel}</p>
          <div className="w-full">
            <SeoCancelScheduleNotice className="max-w-[720px] mx-auto" />
          </div>
          {trialHint}
          {tier !== 'GUEST' && (
            <Link href="/seo/dashboard/plan" className="text-xs font-black text-blue-600 hover:text-blue-800">
              アカウント画面でプラン変更/解約を行う →
            </Link>
          )}
        </div>

        <div className="space-y-6">
          {/* FREE */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{free?.name || 'フリー'}</h2>
                <p className="text-sm text-slate-600 mt-2">
                  ログイン：1日{SEO_PRICING.freeLimit}回まで記事生成（画像生成はPROから）
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-900 font-black text-sm">
                    <Lock className="w-4 h-4 mr-2 text-slate-500" />
                    画像生成（図解）はPROから
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-2xl">
                  {free?.priceLabel || '¥0'}
                </div>
              </div>
            </div>
          </div>

          {/* PRO */}
          <div className="rounded-3xl bg-slate-900 p-8 text-white">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/70">
                  <Crown className="w-4 h-4 text-blue-300" />
                  PRO
                </div>
                <h2 className="text-2xl font-black mt-2">{pro?.name || 'プロ'}</h2>
                <p className="text-sm text-white/80 mt-2">
                  1日{SEO_PRICING.proLimit}記事まで。図解/再生成/自動修正など、制作フローが一気に解放されます。
                </p>
                <ul className="mt-5 space-y-2 text-sm font-bold text-white/90">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-300" /> 1日{SEO_PRICING.proLimit}記事まで生成</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-300" /> 図解/バナー生成（記事に合わせて自動）</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-300" /> SEO改善提案のAI自動修正</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-300" /> 履歴保存：直近3ヶ月</li>
                </ul>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xl">
                  {pro?.priceLabel || '¥9,980'}{pro?.period || '/月'}
                </div>
              </div>
            </div>
            <div className="mt-6">
              {tier === 'PRO' ? (
                <button disabled className="w-full py-4 rounded-2xl text-base font-black bg-white/20 text-white cursor-not-allowed">
                  現在のプラン
                </button>
              ) : tier === 'ENTERPRISE' ? (
                <button disabled className="w-full py-4 rounded-2xl text-base font-black bg-white/20 text-white cursor-not-allowed">
                  プランダウングレード
                </button>
              ) : (
                <CheckoutButton planId="seo-pro" loginCallbackUrl="/seo/pricing" className="w-full py-4 rounded-2xl text-base" variant="secondary">
                  PROを始める
                </CheckoutButton>
              )}
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl bg-[#F7F6F1] p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  Enterprise
                </div>
                <h2 className="text-2xl font-black text-slate-900 mt-2">{enterprise?.name || 'エンタープライズ'}</h2>
                <p className="text-sm text-slate-600 mt-2">
                  1日{SEO_PRICING.enterpriseLimit || 30}記事まで。チーム運用・大量制作向け。
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-700 font-bold">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> 1日{SEO_PRICING.enterpriseLimit || 30}記事まで生成</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> 図解/バナー生成＋再生成</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> 優先サポート</li>
                </ul>
              </div>
              <div className="flex-shrink-0">
                <div className="px-6 py-4 rounded-2xl bg-white text-slate-900 font-black text-xl">
                  {enterprise?.priceLabel || '¥49,980'}{enterprise?.period || '/月'}
                </div>
              </div>
            </div>
            <div className="mt-6">
              {tier === 'ENTERPRISE' ? (
                <button disabled className="w-full py-4 rounded-2xl text-base font-black bg-slate-200 text-slate-600 cursor-not-allowed">
                  現在のプラン
                </button>
              ) : (
                <CheckoutButton planId="seo-enterprise" loginCallbackUrl="/seo/pricing" className="w-full py-4 rounded-2xl text-base">
                  {tier === 'PRO' ? 'Enterpriseにアップグレード' : 'Enterpriseを始める'}
                </CheckoutButton>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          {isLoggedIn ? (
            <Link href="/seo/dashboard/plan">
              <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                アカウント画面でプランを管理する
              </button>
            </Link>
          ) : (
            <Link href="/auth/signin">
              <button className="px-8 py-4 rounded-full bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                ログインして無料トライアルを開始する
              </button>
            </Link>
          )}
        </div>
      </main>

      {/* Welcome modal */}
      <AnimatePresence>
        {welcomeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setWelcomeOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              className="relative bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setWelcomeOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">ようこそ！プランが有効になりました</h3>
                <p className="text-slate-600 font-bold mb-6">
                  {welcomePlan === 'enterprise' ? 'Enterprise' : 'PRO'} の機能が解放されました。画像生成やAI自動修正が使えます。
                </p>
                <Link href="/seo">
                  <button className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                    生成記事一覧へ戻る
                  </button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


