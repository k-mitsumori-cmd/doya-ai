'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getGuestUsage, getUserUsage } from '@/lib/pricing'
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
  ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

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
  const bannerPlan = session ? String((session.user as any)?.bannerPlan || (session.user as any)?.plan || 'FREE').toUpperCase() : 'GUEST'
  const isPro = !isGuest && bannerPlan === 'PRO'

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [usageCount, setUsageCount] = useState(0)
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('banner_history')
      if (stored) setHistory(JSON.parse(stored) as HistoryItem[])
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const today = new Date().toISOString().split('T')[0]
      if (isGuest) {
        const u = getGuestUsage('banner')
        setUsageCount(u.date === today ? u.count : 0)
      } else {
        const u = getUserUsage('banner')
        setUsageCount(u.date === today ? u.count : 0)
      }
    } catch {
      setUsageCount(0)
    }
  }, [isGuest])

  const dailyLimit = isGuest ? BANNER_PRICING.guestLimit : isPro ? BANNER_PRICING.proLimit : BANNER_PRICING.freeLimit
  const remaining = Math.max(0, dailyLimit - usageCount)

  const totalBanners = useMemo(() => history.reduce((acc, h) => acc + (h.banners?.length || 0), 0), [history])
  const savedMinutes = totalBanners * ESTIMATED_TIME_SAVED_PER_BANNER_MIN
  const savedHours = Math.floor(savedMinutes / 60)
  const savedCost = Math.floor((savedMinutes / 60) * HOURLY_DESIGNER_RATE_JPY)

  const currentPlanLabel =
    isGuest ? 'ゲスト' : isPro ? '有料版（PRO）' : '無料版'

  const planBadge =
    isPro ? { text: 'PRO', cls: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' }
      : isGuest ? { text: 'GUEST', cls: 'bg-gray-200 text-gray-700' }
        : { text: 'FREE', cls: 'bg-blue-100 text-blue-700' }

  const handleOpenPortal = async () => {
    if (isPortalLoading) return
    setIsPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ポータルを開けませんでした')
      if (data.url) window.location.href = data.url
    } catch (e: any) {
      toast.error(e?.message || 'ポータルの起動に失敗しました')
    } finally {
      setIsPortalLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (isCheckoutLoading) return
    setIsCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'banner-pro', billingPeriod: 'monthly' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '決済ページを開けませんでした')
      if (data.url) window.location.href = data.url
    } catch (e: any) {
      toast.error(e?.message || '決済ページの起動に失敗しました')
    } finally {
      setIsCheckoutLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardSidebar />
        <div className="pl-[72px] lg:pl-[240px] min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <DashboardSidebar />
      <div className="pl-[72px] lg:pl-[240px] transition-all duration-200">
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
                        {isPro && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-lg shadow-blue-200 uppercase tracking-widest">
                            Official Plan
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">{currentPlanLabel}</h2>
                      <p className="text-sm text-slate-500 mt-2 font-medium">
                        日次上限: <span className="font-bold text-slate-800">{dailyLimit}</span> 回 / 今日の残り: <span className="font-bold text-blue-600">{remaining}</span> 回
                      </p>
                    </div>

                    <div className="text-right">
                      {isPro ? (
                        <div className="text-3xl font-black text-slate-800 tracking-tighter">
                          ¥4,980<span className="text-sm text-slate-400 font-bold ml-1">/mo</span>
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
                        href="/api/auth/signin"
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Sparkles className="w-5 h-5" />
                        ログインして利用を開始
                      </Link>
                    ) : isPro ? (
                      <button
                        onClick={handleOpenPortal}
                        disabled={isPortalLoading}
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-60"
                      >
                        {isPortalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BadgeCheck className="w-5 h-5" />}
                        Stripeで契約を管理する
                      </button>
                    ) : (
                      <button
                        onClick={handleUpgrade}
                        disabled={isCheckoutLoading}
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                      >
                        {isCheckoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                        PROプランへアップグレード
                      </button>
                    )}

                    <Link
                      href={HIGH_USAGE_CONTACT_URL || '/banner/pricing'}
                      className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border border-gray-200 text-slate-800 font-black hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <ArrowUpRight className="w-5 h-5 text-blue-600" />
                      法人・一括契約相談
                    </Link>
                  </div>
                </div>

                {/* Metrics */}
                <div className="p-8">
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="rounded-3xl border border-gray-100 p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">推定削減時間</p>
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
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">推定コスト削減</p>
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


