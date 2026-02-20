'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerMonthlyLimitByUserPlan, getGuestUsage } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'
import BannerCancelScheduleNotice from '@/components/BannerCancelScheduleNotice'
import {
  ArrowUpRight,
  BarChart3,
  Clock,
  Crown,
  Layers,
  Loader2,
  Sparkles,
  Target,
  CheckCircle2,
  MessageSquare,
  Zap,
  Settings,
  DollarSign,
  CreditCard,
  ArrowRight,
  Info,
  Check,
  X,
  AlertTriangle,
  CalendarClock
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'

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
  const [isCanceling, setIsCanceling] = useState(false)
  const [isSyncingPlan, setIsSyncingPlan] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const [cancelScheduledAt, setCancelScheduledAt] = useState<Date | null>(null)
  const [cancelMode, setCancelMode] = useState<'period_end' | 'immediate' | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const isLoggedIn = !!session?.user?.email

  const formatJstDateTime = (d: Date) => {
    try {
      return d.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return d.toISOString()
    }
  }

  const handleCancelSubscription = async () => {
    setShowCancelConfirm(false)
    if (isGuest) {
      toast.error('ログインが必要です')
      return
    }
    try {
      setIsCanceling(true)
      setCancelScheduledAt(null)
      setCancelMode(null)
      const res = await fetch('/api/stripe/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'banner', mode: 'period_end' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '解約に失敗しました')
      const end = data?.currentPeriodEnd ? new Date(Number(data.currentPeriodEnd) * 1000) : null
      if (end && !Number.isNaN(end.getTime())) {
        setCancelScheduledAt(end)
        setCancelMode('period_end')
        try {
          localStorage.setItem('banner:cancelScheduledAt', end.toISOString())
        } catch {}
        toast.success(`解約を受け付けました（${formatJstDateTime(end)}に停止 / 日本時間）`)
      } else {
        toast.success('解約を受け付けました')
      }
    } catch (e: any) {
      toast.error(e?.message || '解約に失敗しました')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleResumeSubscription = async () => {
    setIsCanceling(true)
    try {
      const res = await fetch('/api/stripe/subscription/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'banner' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解約取り消しに失敗しました')
      setCancelScheduledAt(null)
      setCancelMode(null)
      localStorage.removeItem('banner:cancelScheduledAt')
      toast.success('解約予約を取り消しました！引き続きPRO/Enterpriseプランをご利用いただけます。')
    } catch (err: any) {
      toast.error(err.message || '解約取り消しに失敗しました')
    } finally {
      setIsCanceling(false)
    }
  }

  // Stripeから解約予定日を取得
  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/stripe/subscription/status?serviceId=banner', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && json.cancelAtPeriodEnd && json.currentPeriodEnd) {
          setCancelScheduledAt(new Date(Number(json.currentPeriodEnd) * 1000))
          setCancelMode('period_end')
        } else {
          // localStorageのフォールバック
          try {
            const raw = localStorage.getItem('banner:cancelScheduledAt')
            if (raw) {
              const d = new Date(raw)
              if (!Number.isNaN(d.getTime())) {
                setCancelScheduledAt(d)
                setCancelMode('period_end')
              }
            }
          } catch {}
        }
      } catch {
        // localStorageのフォールバック
        try {
          const raw = localStorage.getItem('banner:cancelScheduledAt')
          if (raw) {
            const d = new Date(raw)
            if (!Number.isNaN(d.getTime())) {
              setCancelScheduledAt(d)
              setCancelMode('period_end')
            }
          }
        } catch {}
      }
    })()
    return () => { cancelled = true }
  }, [isLoggedIn])

  const handleSyncPlan = async () => {
    if (isGuest) {
      toast.error('ログインが必要です')
      return
    }
    try {
      setIsSyncingPlan(true)
      toast.loading('Stripeの契約状況を確認中…', { id: 'plan-sync' })
      const res = await fetch('/api/stripe/sync/latest', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'プラン反映に失敗しました')
      toast.success('プランを反映しました！', { id: 'plan-sync' })
      // 他画面へ即通知
      try {
        window.dispatchEvent(
          new CustomEvent('doya:plan-updated', {
            detail: { serviceId: 'banner', planTier: String(data?.planId || '').includes('enterprise') ? 'ENTERPRISE' : 'PRO', source: 'manual', at: Date.now() },
          })
        )
      } catch {}
    } catch (e: any) {
      toast.error(e?.message || 'プラン反映に失敗しました', { id: 'plan-sync' })
    } finally {
      setIsSyncingPlan(false)
    }
  }

  // APIから統計情報を取得（ログインユーザーの場合）
  useEffect(() => {
    if (status === 'loading') return
    
    const loadStats = async () => {
      if (isGuest) {
        // ゲストはlocalStorageから取得（月次）
        try {
          const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
          const u = getGuestUsage('banner')
          // 月次比較（旧YYYY-MM-DD形式にも対応）
          setUsageCount(u.date && u.date.slice(0, 7) === currentMonth ? u.count : 0)

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
            setUsageCount(data.monthlyUsage || 0)
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

  // ログイン時は「プラン階層」で月間上限を決める（plan文字列の揺れに強い）
  const monthlyLimit = isGuest ? BANNER_PRICING.guestLimit : getBannerMonthlyLimitByUserPlan(bannerPlanTier)
  const remaining = Math.max(0, monthlyLimit - usageCount)

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
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        <div className="md:pl-[240px] min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <Toaster position="top-center" />
      <div className="md:pl-[240px] transition-all duration-200">
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
                  <Link href="/banner/dashboard/settings" className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                    <Settings className="w-5 h-5" />
                  </Link>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-none">{session?.user?.name || 'ゲスト'}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{session?.user ? 'Member' : 'Guest'}</p>
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
                        月間上限: <span className="font-bold text-slate-800">{monthlyLimit}</span> 枚 / 今月の残り: <span className="font-bold text-blue-600">{remaining}</span> 枚
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
                      <Link
                        href={HIGH_USAGE_CONTACT_URL || '/banner/pricing'}
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all shadow-xl shadow-slate-200"
                      >
                        <ArrowUpRight className="w-5 h-5" />
                        さらに上限UPの相談（丸投げ）
                      </Link>
                    ) : isPro ? (
                      <CheckoutButton
                        planId="banner-enterprise"
                        loginCallbackUrl="/banner/dashboard/plan"
                        variant="secondary"
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black shadow-xl shadow-slate-200 hover:bg-black transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Crown className="w-5 h-5" />
                        エンタープライズにアップグレード
                      </CheckoutButton>
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

                  {/* 決済済みなのに反映されない時の救済 */}
                  {!isGuest && !isPaid && (
                    <div className="mt-3">
                      <button
                        onClick={handleSyncPlan}
                        disabled={isSyncingPlan}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-black hover:bg-slate-50 transition-colors disabled:opacity-60"
                      >
                        {isSyncingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        課金状態を確認してプランを反映する
                      </button>
                      <p className="mt-2 text-[11px] text-slate-500 font-bold">
                        ※ 決済直後にPROへ切り替わらない場合のみ押してください（Stripe→DBを再同期します）
                      </p>
                    </div>
                  )}

                  {/* 解約予約中の表示（Stripeの実状態から取得） */}
                  {!isGuest && isPaid && cancelScheduledAt && cancelMode === 'period_end' && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center flex-shrink-0">
                          <CalendarClock className="w-6 h-6 text-amber-900" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-amber-900">解約予約中</h3>
                          <p className="text-sm font-black text-amber-800 mt-1">
                            <span className="underline">{formatJstDateTime(cancelScheduledAt)}</span> に停止予定（日本時間）
                          </p>
                          <p className="mt-2 text-[11px] font-bold text-amber-700">
                            停止日時まではPRO/Enterpriseの機能をご利用いただけます。
                          </p>
                          <button
                            onClick={handleResumeSubscription}
                            disabled={isCanceling}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {isCanceling && <Loader2 className="w-4 h-4 animate-spin" />}
                            解約を取り消してプランを継続する
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 契約解除ボタン（解約予約がない場合のみ） */}
                  {!isGuest && isPaid && !cancelScheduledAt && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        disabled={isCanceling}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-black hover:bg-red-100 transition-colors disabled:opacity-60"
                      >
                        {isCanceling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        プランを解約する
                      </button>
                      <p className="mt-2 text-[11px] text-slate-500 font-bold">
                        ※ 解約は「次回更新日で停止」です（即時停止が必要な場合はお問い合わせください）
                      </p>
                    </div>
                  )}
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

              {/* 料金プラン比較表 */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-100">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    料金プラン比較
                  </h3>
                  <p className="text-sm text-slate-500 font-bold mt-1">
                    用途に合わせてプランをお選びください
                  </p>
                </div>
                <div className="p-8">
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* ゲスト/無料 */}
                    <div className={`rounded-2xl border p-5 ${bannerPlanTier === 'FREE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-slate-50'}`}>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">ログイン</p>
                      <p className="text-xl font-black text-slate-900 mt-1">無料プラン</p>
                      <p className="text-2xl font-black text-slate-800 mt-2">¥0</p>
                      <ul className="mt-4 space-y-2 text-sm text-slate-600 font-bold">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> ゲスト：月{BANNER_PRICING.guestLimit}枚まで</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> ログイン：月{BANNER_PRICING.freeLimit}枚まで</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> サイズ：1080×1080固定</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-600" /> 同時生成：最大3枚</li>
                      </ul>
                      {bannerPlanTier === 'FREE' && (
                        <p className="mt-4 text-xs font-black text-blue-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 現在のプラン
                        </p>
                      )}
                    </div>

                    {/* PRO */}
                    <div className={`rounded-2xl border p-5 ${bannerPlanTier === 'PRO' ? 'border-blue-500 bg-blue-900' : 'border-slate-900 bg-slate-900'} text-white`}>
                      <p className="text-xs font-black text-white/70 uppercase tracking-widest">PRO</p>
                      <p className="text-xl font-black mt-1">プロプラン</p>
                      <p className="text-2xl font-black mt-2">¥9,980<span className="text-sm font-bold opacity-70">/月</span></p>
                      <ul className="mt-4 space-y-2 text-sm text-white/90 font-bold">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> 月{BANNER_PRICING.proLimit}枚まで生成</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> サイズ自由指定</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-blue-400" /> 同時生成：最大5枚</li>
                      </ul>
                      {bannerPlanTier === 'PRO' ? (
                        <p className="mt-4 text-xs font-black text-blue-300 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 現在のプラン
                        </p>
                      ) : bannerPlanTier !== 'ENTERPRISE' && (
                        <div className="mt-4">
                          <CheckoutButton planId="banner-pro" loginCallbackUrl="/banner/dashboard/plan" className="w-full py-2 rounded-xl text-xs" variant="secondary">
                            PROを始める
                          </CheckoutButton>
                        </div>
                      )}
                    </div>

                    {/* Enterprise */}
                    <div className={`rounded-2xl border p-5 ${bannerPlanTier === 'ENTERPRISE' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Enterprise</p>
                      <p className="text-xl font-black text-slate-900 mt-1">エンタープライズ</p>
                      <p className="text-2xl font-black text-slate-800 mt-2">¥49,800<span className="text-sm font-bold text-slate-400">/月</span></p>
                      <ul className="mt-4 space-y-2 text-sm text-slate-600 font-bold">
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> 月{BANNER_PRICING.enterpriseLimit || 1000}枚まで生成</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> 大量運用・チーム向け</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> 優先サポート</li>
                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-purple-600" /> さらに上限UP相談可</li>
                      </ul>
                      {bannerPlanTier === 'ENTERPRISE' ? (
                        <p className="mt-4 text-xs font-black text-purple-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> 現在のプラン
                        </p>
                      ) : (
                        <div className="mt-4">
                          <CheckoutButton planId="banner-enterprise" loginCallbackUrl="/banner/dashboard/plan" className="w-full py-2 rounded-xl text-xs">
                            {bannerPlanTier === 'PRO' ? 'アップグレード' : 'Enterpriseを始める'}
                          </CheckoutButton>
                        </div>
                      )}
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

      {/* 解約確認モーダル */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowCancelConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <Sparkles className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">ちょっと待ってください！</h3>
                <p className="text-slate-600 font-bold mb-6">本当に解約しますか？PRO/Enterpriseプランにはこんなメリットがあります。</p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-slate-700 font-bold">
                    <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1">高品質なバナー生成（月最大{BANNER_PRICING.proLimit}〜{BANNER_PRICING.enterpriseLimit}枚）</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-700 font-bold">
                    <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1">自由なサイズ指定（無料版は1080×1080固定）</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-700 font-bold">
                    <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="flex-1">優先サポートで安心</span>
                  </li>
                </ul>
                <p className="text-sm text-slate-500 mb-6">
                  解約後、再度アップグレードすることも可能です！
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
                  >
                    やっぱりプランを継続する
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isCanceling}
                    className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCanceling && <Loader2 className="w-4 h-4 animate-spin" />}
                    それでも解約する
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
