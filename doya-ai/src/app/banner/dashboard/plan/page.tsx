'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerDailyLimitByUserPlan, getGuestUsage } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Clock,
  Crown,
  Layers,
  Loader2,
  Sparkles,
  Star,
  Target,
  CheckCircle2,
  MessageSquare,
  Image as ImageIcon,
  Zap,
  Bell,
  Settings,
  DollarSign,
  ChevronDown,
  CreditCard,
  ArrowRight,
  Info
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'

type HistoryItem = {
  id: string
  category: string
  keyword: string
  size: string
  createdAt: string
  banners: string[]
}

const ESTIMATED_TIME_SAVED_PER_BANNER_MIN = 45
const HOURLY_DESIGNER_RATE_JPY = 3000

export default function BannerPlanPage() {
  const { data: session, status } = useSession()
  const isGuest = !session
  const bannerPlanRaw = session ? String((session.user as any)?.bannerPlan || (session.user as any)?.plan || 'FREE').toUpperCase() : 'GUEST'
  const bannerPlanTier = (() => {
    const p = String(bannerPlanRaw || '').toUpperCase()
    if (!p || p === 'GUEST') return 'GUEST' as const
    // 既存環境の揺れに耐える（例: BANNER_PRO / PRO_MONTHLY / BASIC / STARTER / BUSINESS など）
    if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
    if (p.includes('PRO') || p.includes('BASIC') || p.includes('STARTER') || p.includes('BUSINESS')) return 'PRO' as const
    if (p.includes('FREE')) return 'FREE' as const
    // 不明だがログイン済みの場合はFREE扱い（安全側）
    return 'FREE' as const
  })()

  const isEnterprise = !isGuest && bannerPlanTier === 'ENTERPRISE'
  const isPro = !isGuest && bannerPlanTier === 'PRO'
  const isPaid = !isGuest && (bannerPlanTier === 'PRO' || bannerPlanTier === 'ENTERPRISE')

  const [totalBanners, setTotalBanners] = useState(0)
  const [usageCount, setUsageCount] = useState(0)
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)

  // APIから統計情報を取得（ログインユーザーの場合）
  useEffect(() => {
    if (status === 'loading') return
    
    const loadStats = async () => {
      if (isGuest) {
        // ゲストはlocalStorageから取得
        try {
          const today = new Date().toISOString().split('T')[0]
          const u = getGuestUsage('banner')
          setUsageCount(u.date === today ? u.count : 0)
          
          // ゲストの累計枚数はlocalStorageから（ただしほぼ0になる）
          const stored = localStorage.getItem('banner_history')
          if (stored) {
            const history = JSON.parse(stored) as HistoryItem[]
            const total = history.reduce((acc, h) => acc + (h.banners?.length || 0), 0)
            setTotalBanners(total)
          }
        } catch {
          setUsageCount(0)
          setTotalBanners(0)
        }
      } else {
        // ログインユーザーはAPIから取得
        try {
          const res = await fetch('/api/banner/stats')
          if (res.ok) {
            const data = await res.json()
            setTotalBanners(data.totalBanners || 0)
            setUsageCount(data.todayUsage || 0)
          }
        } catch {
          setTotalBanners(0)
          setUsageCount(0)
        }
      }
      setStatsLoaded(true)
    }
    
    loadStats()
  }, [isGuest, status])

  // ログイン時は「プラン階層」で日次上限を決める（plan文字列の揺れに強い）
  const dailyLimit = isGuest ? BANNER_PRICING.guestLimit : getBannerDailyLimitByUserPlan(bannerPlanTier)
  const remaining = Math.max(0, dailyLimit - usageCount)

  const savedMinutes = totalBanners * ESTIMATED_TIME_SAVED_PER_BANNER_MIN
  const savedHours = Math.floor(savedMinutes / 60)
  const savedCost = Math.floor((savedMinutes / 60) * HOURLY_DESIGNER_RATE_JPY)

  const estimateBasisText = `根拠：\n- 1枚あたりの制作時間を ${ESTIMATED_TIME_SAVED_PER_BANNER_MIN} 分と仮定\n- デザイナー時給を ${HOURLY_DESIGNER_RATE_JPY.toLocaleString()} 円と仮定\n\n計算：\n- 推定削減時間 = 累計生成枚数 × ${ESTIMATED_TIME_SAVED_PER_BANNER_MIN} 分 ÷ 60\n- 推定コスト削減 = 推定削減時間（時間）× ${HOURLY_DESIGNER_RATE_JPY.toLocaleString()} 円`

  const currentPlanLabel =
    isGuest ? 'ゲスト' : isEnterprise ? 'エンタープライズ' : isPaid ? 'プロ' : '無料'

  const planBadge =
    isEnterprise
      ? { text: 'ENTERPRISE', cls: 'bg-rose-600 text-white shadow-sm shadow-rose-600/20' }
      : isPaid
        ? { text: 'PRO', cls: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' }
        : isGuest
          ? { text: 'GUEST', cls: 'bg-gray-200 text-gray-700' }
          : { text: 'FREE', cls: 'bg-blue-100 text-blue-700' }

  // 契約管理 / 課金開始は「リンク遷移」＋CheckoutButtonに統一（確実にStripeへ遷移）

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardSidebar />
        <div className="pl-[72px] md:pl-[240px] min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <DashboardSidebar />
      <Toaster position="top-center" />
      <div className="pl-[72px] md:pl-[240px] transition-all duration-200">
        {/* ========================================
            Header - Doya Banner Style
            ======================================== */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
            <div className="h-16 sm:h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <ArrowRight className="w-5 h-5 text-slate-400 rotate-180" />
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  サービスプラン
                </h1>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden md:flex items-center gap-2">
                  <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                  </button>
                  <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-none">{session?.user?.name || '田中 太郎'}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Admin</p>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8">

          <div className="grid lg:grid-cols-[1fr,360px] gap-8">
            {/* Main card */}
            <div className="space-y-8">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 bg-slate-50/50 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${planBadge.cls}`}>
                          {planBadge.text}
                        </span>
                        {isPaid && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-lg shadow-blue-200 uppercase tracking-widest">
                            Official Plan
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">{currentPlanLabel}</h2>
                      <p className="text-sm text-slate-500 mt-2 font-medium">
                        日次上限: <span className="font-bold text-slate-800">{dailyLimit}</span> 枚 / 今日の残り: <span className="font-bold text-blue-600">{remaining}</span> 枚
                      </p>
                    </div>

                    <div className="text-right">
                      {isEnterprise ? (
                        <div className="text-3xl font-black text-slate-800 tracking-tighter">
                          ¥49,800<span className="text-sm text-slate-400 font-bold ml-1">/mo</span>
                        </div>
                      ) : isPaid ? (
                        <div className="text-3xl font-black text-slate-800 tracking-tighter">
                          ¥9,980<span className="text-sm text-slate-400 font-bold ml-1">/mo</span>
                        </div>
                      ) : (
                        <div className="text-3xl font-black text-slate-800 tracking-tighter">
                          ¥0<span className="text-sm text-slate-400 font-bold ml-1">/free</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    {isGuest ? (
                      <Link
                        href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/banner/dashboard/plan')}`}
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Sparkles className="w-5 h-5" />
                        ログインして利用を開始
                      </Link>
                    ) : isEnterprise ? (
                      <>
                        <a
                          href={`/api/stripe/portal/redirect?returnTo=${encodeURIComponent('/banner/dashboard/plan')}`}
                          className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all shadow-xl shadow-slate-200"
                          onClick={() => setIsPortalLoading(true)}
                        >
                          {isPortalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BadgeCheck className="w-5 h-5" />}
                          契約管理
                        </a>
                        <Link
                          href={HIGH_USAGE_CONTACT_URL || '/banner/pricing'}
                          className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border border-gray-200 text-slate-800 font-black hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <ArrowUpRight className="w-5 h-5 text-blue-600" />
                          さらに上限UPの相談（丸投げ）
                        </Link>
                      </>
                    ) : isPro ? (
                      <>
                        <CheckoutButton
                          planId="banner-enterprise"
                          loginCallbackUrl="/banner/dashboard/plan"
                          variant="secondary"
                          className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black shadow-xl shadow-slate-200 hover:bg-black transition-all hover:scale-[1.02] active:scale-95"
                        >
                          <Crown className="w-5 h-5" />
                          エンタープライズにアップグレード
                        </CheckoutButton>
                        <a
                          href={`/api/stripe/portal/redirect?returnTo=${encodeURIComponent('/banner/dashboard/plan')}`}
                          className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border border-gray-200 text-slate-800 font-black hover:bg-slate-50 transition-all shadow-sm"
                          onClick={() => setIsPortalLoading(true)}
                        >
                          {isPortalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BadgeCheck className="w-5 h-5 text-blue-600" />}
                          契約管理
                        </a>
                      </>
                    ) : (
                      <>
                        <CheckoutButton
                          planId="banner-pro"
                          loginCallbackUrl="/banner/dashboard/plan"
                          variant="secondary"
                          className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                        >
                          <Zap className="w-5 h-5" />
                          プロプランへアップグレード
                        </CheckoutButton>
                      </>
                    )}

                    {/* 無料ユーザーのみ：比較用にプランページ導線を残す */}
                    {!isGuest && !isPaid && (
                      <Link
                        href="/banner/pricing"
                        className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border border-gray-200 text-slate-800 font-black hover:bg-slate-50 transition-all shadow-sm"
                      >
                        <ArrowUpRight className="w-5 h-5 text-blue-600" />
                        料金プランを見る
                      </Link>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="p-8">
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="rounded-3xl border border-gray-100 p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">推定削減時間</p>
                        <span className="relative group/tt">
                          <Info className="w-4 h-4 text-slate-400 cursor-help" aria-label="根拠" />
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-[260px] whitespace-pre-line rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-xl opacity-0 group-hover/tt:opacity-100 transition-opacity"
                          >
                            {estimateBasisText}
                          </span>
                        </span>
                      </div>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter">
                        {savedHours}<span className="text-sm text-slate-400 font-bold ml-1">時間</span>
                      </p>
                    </div>
                    <div className="rounded-3xl border border-gray-100 p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Layers className="w-6 h-6 text-orange-500" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">累計生成枚数</p>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter">
                        {totalBanners}<span className="text-sm text-slate-400 font-bold ml-1">枚</span>
                      </p>
                    </div>
                    <div className="rounded-3xl border border-gray-100 p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">推定コスト削減</p>
                        <span className="relative group/tt">
                          <Info className="w-4 h-4 text-slate-400 cursor-help" aria-label="根拠" />
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-[260px] whitespace-pre-line rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-xl opacity-0 group-hover/tt:opacity-100 transition-opacity"
                          >
                            {estimateBasisText}
                          </span>
                        </span>
                      </div>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter">
                        ¥{savedCost.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Side panel */}
            <div className="space-y-6">
              {/* Recommended usage */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <p className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  おすすめの使い方
                </p>

                <div className="space-y-4">
                  {[
                    {
                      title: '最短1分。AIと会話して生成',
                      desc: 'チャットで「用途や雰囲気」を伝えるだけで、AIが最適なプランを構成します。',
                      href: '/banner/dashboard/chat',
                      icon: MessageSquare,
                      color: 'bg-blue-600',
                      cta: 'チャットを開く',
                    },
                    {
                      title: 'A/B/C 3案を同時に比較',
                      desc: '異なるアプローチの3案を生成し、最も反応が良さそうなものを選びます。',
                      href: '/banner',
                      icon: Sparkles,
                      color: 'bg-orange-500',
                      cta: 'バナー作成',
                    }
                  ].map((s, i) => {
                    const Icon = s.icon
                    return (
                      <div key={i} className="rounded-2xl border border-gray-100 p-5 bg-slate-50/50 hover:bg-white hover:border-blue-100 transition-all group">
                        <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shadow-lg shadow-blue-100 mb-4 group-hover:scale-110 transition-transform`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-sm font-black text-slate-800 mb-1">{s.title}</p>
                        <p className="text-xs text-slate-500 leading-relaxed mb-4">{s.desc}</p>
                        <Link
                          href={s.href}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          {s.cta}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 p-5 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-200">
                  <p className="text-xs font-black uppercase tracking-widest mb-3 opacity-80">CTR Checklist</p>
                  <div className="space-y-2.5">
                    {[
                      '数字（価格・％）を際立たせる',
                      'ベネフィットを大きく配置',
                      'ターゲットへの問いかけを入れる',
                    ].map((t) => (
                      <div key={t} className="flex items-center gap-2 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


