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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900">現在契約中のプラン</h1>
                <p className="text-xs text-gray-500">利用状況・上限・アップグレード/管理</p>
              </div>
            </div>
            <Link
              href="/banner/pricing"
              className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              料金プランを見る
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-5">
            {/* Main card */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-lg shadow-gray-200/20 overflow-hidden">
              <div className="p-6 sm:p-7 bg-blue-50/50 border-b border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-black ${planBadge.cls}`}>
                        {planBadge.text}
                      </span>
                      {isPro && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-black bg-orange-50 text-orange-700 border border-orange-200/60">
                          人気
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900">{currentPlanLabel}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      日次上限: <span className="font-black text-gray-900">{dailyLimit}</span> 回 / 今日の残り: <span className="font-black text-blue-600">{remaining}</span> 回
                    </p>
                  </div>

                  <div className="text-right">
                    {isPro ? (
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                        <Crown className="w-4 h-4" />
                        <span className="text-sm font-black">¥4,980/月</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-gray-100 text-gray-700">
                        <Star className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-black">¥0</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-5 flex flex-col sm:flex-row gap-2">
                  {isGuest ? (
                    <Link
                      href="/api/auth/signin"
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20"
                    >
                      <Sparkles className="w-5 h-5" />
                      ログインして回数を増やす
                    </Link>
                  ) : isPro ? (
                    <button
                      onClick={handleOpenPortal}
                      disabled={isPortalLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white font-black hover:bg-black transition-colors disabled:opacity-60"
                    >
                      {isPortalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BadgeCheck className="w-5 h-5" />}
                      サブスク管理（Stripe）
                    </button>
                  ) : (
                    <button
                      onClick={handleUpgrade}
                      disabled={isCheckoutLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20 disabled:opacity-60"
                    >
                      {isCheckoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                      有料版へアップグレード
                    </button>
                  )}

                  <Link
                    href={HIGH_USAGE_CONTACT_URL || '/banner/pricing'}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 font-black hover:bg-gray-50 transition-colors"
                  >
                    <ArrowUpRight className="w-5 h-5 text-blue-600" />
                    上位利用（要相談）
                  </Link>
                </div>
              </div>

              {/* Metrics */}
              <div className="p-6 sm:p-7">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-gray-200 p-4 bg-white">
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-bold">
                      <Clock className="w-4 h-4 text-blue-600" />
                      推定削減時間
                    </div>
                    <div className="mt-1 text-2xl font-black text-gray-900">
                      {savedHours}<span className="text-sm text-gray-500 font-bold ml-1">時間</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">※ 1枚=45分で概算</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4 bg-white">
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-bold">
                      <BarChart3 className="w-4 h-4 text-cyan-600" />
                      生成枚数（累計）
                    </div>
                    <div className="mt-1 text-2xl font-black text-gray-900">
                      {totalBanners}<span className="text-sm text-gray-500 font-bold ml-1">枚</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">ローカル履歴から集計</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 p-4 bg-white">
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-bold">
                      <Zap className="w-4 h-4 text-amber-600" />
                      推定コスト削減
                    </div>
                    <div className="mt-1 text-2xl font-black text-gray-900">
                      ¥{savedCost.toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">※ 時給3,000円で概算</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-200/60 p-4">
                  <p className="text-sm font-black text-sky-900">この画面の狙い</p>
                  <p className="mt-1 text-sm text-gray-700">
                    「どれだけ制作時間を削減できているか」を見える化し、必要なときに最短でアップグレード・管理できる導線を用意しています。
                  </p>
                </div>
              </div>
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              {/* Recommended usage */}
              <div className="bg-white rounded-3xl border border-gray-200/70 shadow-sm p-5">
                <p className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  おすすめの使い方
                </p>

                <div className="space-y-3">
                  {[
                    {
                      title: '1分で要件を固める（最短）',
                      desc: 'AIチャットで「用途/業種/訴求/雰囲気」を会話で整理→そのまま生成。',
                      href: '/banner/dashboard/chat',
                      icon: MessageSquare,
                      color: 'from-blue-600 to-cyan-600',
                      cta: 'AIチャットを開く',
                    },
                    {
                      title: 'A/B/Cを比較してCTRを上げる',
                      desc: 'まず3案生成→良い案をベースに、色や訴求を微調整して2回目で完成度UP。',
                      href: '/banner',
                      icon: Sparkles,
                      color: 'from-sky-600 to-blue-600',
                      cta: 'バナー生成へ',
                    },
                    {
                      title: '履歴から“当たり”を再利用する',
                      desc: '過去の当たり構図・配色を見返して、次の制作に転用。',
                      href: '/banner/dashboard/history',
                      icon: Clock,
                      color: 'from-slate-700 to-slate-900',
                      cta: '履歴を見る',
                    },
                  ].map((s, i) => {
                    const Icon = s.icon
                    return (
                      <div key={i} className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-gray-900">{s.title}</p>
                                <p className="mt-0.5 text-xs text-gray-600">{s.desc}</p>
                              </div>
                            </div>
                          </div>
                          <Link
                            href={s.href}
                            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs font-black hover:bg-gray-50"
                          >
                            {s.cta}
                            <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 border border-sky-200/60 p-4">
                  <p className="text-xs font-black text-sky-900 mb-2">“CTRが上がる”ための型（チェックリスト）</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      '数字（%OFF / 期間 / 価格）を入れる',
                      'ベネフィットを先頭に置く（例:「予約が3倍に」）',
                      'イメージ説明で主役（人物/商品/背景）を明確化',
                      '色は3〜5色に絞ってコントラストを強める',
                    ].map((t) => (
                      <div key={t} className="flex items-center gap-2 text-xs text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-200/70 shadow-sm p-5">
                <p className="text-sm font-black text-gray-900 mb-3">導入ユーザーの声</p>
                <div className="space-y-3">
                  {[
                    { name: '広告代理店・運用担当', text: '制作の初速が速くなり、ABテストの回転数が上がりました。' },
                    { name: 'EC・マーケ責任者', text: 'セールの訴求を即日で量産でき、機会損失が減りました。' },
                    { name: 'SaaS・インサイドセールス', text: 'ウェビナー告知が短時間で作れて、集客が安定しました。' },
                  ].map((t, i) => (
                    <div key={i} className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50">
                      <p className="text-sm text-gray-800 font-medium">“{t.text}”</p>
                      <p className="mt-2 text-xs text-gray-500 font-bold">— {t.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-200/70 shadow-sm p-5">
                <p className="text-sm font-black text-gray-900 mb-3">次の一手</p>
                <div className="space-y-2">
                  <Link
                    href="/banner/dashboard/chat"
                    className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black"
                  >
                    AIチャットで要件整理 → 生成
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/banner/dashboard/stats"
                    className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-black hover:bg-gray-50"
                  >
                    効果分析を見る
                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  </Link>
                  <Link
                    href="/banner"
                    className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-black hover:bg-gray-50"
                  >
                    生成画面へ（A/B/C）
                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


