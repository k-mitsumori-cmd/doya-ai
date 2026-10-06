'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { higherPlan, tierFrom } from '@/lib/plan-utils'
import { CheckoutButton } from '@/components/CheckoutButton'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { useBillingPlanResync } from '@/hooks/useBillingPlanResync'
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement'
import { useBannerPlanStats } from '@/hooks/useBannerPlanStats'
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
  X,
  AlertTriangle,
  CalendarClock
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'

const ESTIMATED_TIME_SAVED_PER_BANNER_MIN = 45
const HOURLY_DESIGNER_RATE_JPY = 3000

export default function BannerPlanPage() {
  const { data: session, status } = useSession()
  const isGuest = !session
  const bannerPlanRaw = session ? higherPlan((session.user as any)?.bannerPlan, (session.user as any)?.plan) : 'GUEST'
  const bannerPlanTier = tierFrom(bannerPlanRaw)

  const isEnterprise = !isGuest && bannerPlanTier === 'ENTERPRISE'
  const isPro = !isGuest && bannerPlanTier === 'PRO'
  const isLight = !isGuest && bannerPlanTier === 'LIGHT'
  const isPaid = !isGuest && (isLight || isPro || isEnterprise)

  const stats = useBannerPlanStats()
  const totalBanners = stats.data?.totalBanners ?? null
  const usageCount = stats.data?.monthlyUsage ?? null
  const serverMonthlyLimit = stats.data?.monthlyLimit ?? null
  const statsError = stats.error
  const management = useSubscriptionManagement('banner')
  const isCanceling = management.busy
  const cancelScheduledAt = management.data?.hasSubscription && management.data.cancelAtPeriodEnd ? new Date(management.data.currentPeriodEnd * 1000) : null
  const cancelMode = cancelScheduledAt ? 'period_end' : null
  const [cancelConfirmKey, setCancelConfirmKey] = useState<string | null>(null)
  const showCancelConfirm = cancelConfirmKey === management.scopeKey
  const setShowCancelConfirm = (show: boolean) => setCancelConfirmKey(show ? management.scopeKey : null)
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
    const confirmed = await management.run('cancel')
    if (confirmed) setShowCancelConfirm(false)
  }
  const handleResumeSubscription = async () => {
    await management.run('resume')
  }

  const { run: handleSyncPlan, busy: isSyncingPlan, disabled: syncDisabled, message: syncMessage } = useBillingPlanResync({
    scope: 'banner-dashboard-plan',
    enabled: !isGuest && !isPaid,
    onVerified: syncedTier => {
      window.dispatchEvent(new CustomEvent('doya:plan-updated', {
        detail: { serviceId: 'banner', planTier: syncedTier, source: 'manual', at: Date.now() },
      }))
    },
  })

  const monthlyLimit = serverMonthlyLimit
  const unlimited = monthlyLimit === -1
  const remaining = usageCount === null || monthlyLimit === null || unlimited ? null : Math.max(0, monthlyLimit - usageCount)

  const savedMinutes = (totalBanners ?? 0) * ESTIMATED_TIME_SAVED_PER_BANNER_MIN
  const savedHours = Math.floor(savedMinutes / 60)
  const savedCost = Math.floor((savedMinutes / 60) * HOURLY_DESIGNER_RATE_JPY)

  const estimateBasisText = `根拠：\n- 1枚あたりの制作時間を ${ESTIMATED_TIME_SAVED_PER_BANNER_MIN} 分と仮定\n- デザイナー時給を ${HOURLY_DESIGNER_RATE_JPY.toLocaleString()} 円と仮定\n\n計算：\n- 推定削減時間 = 累計生成枚数 × ${ESTIMATED_TIME_SAVED_PER_BANNER_MIN} 分 ÷ 60\n- 推定コスト削減 = 推定削減時間（時間）× ${HOURLY_DESIGNER_RATE_JPY.toLocaleString()} 円`

  const currentPlanLabel =
    isGuest ? 'ゲスト' : isEnterprise ? 'エンタープライズ' : isPro ? 'プロ' : isLight ? 'ライト' : '無料'

  const planBadge =
    isEnterprise
      ? { text: 'ENTERPRISE', cls: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' }
      : isPro
        ? { text: 'PRO', cls: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' }
        : isLight
          ? { text: 'LIGHT', cls: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' }
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
      {management.message && <div role="status" className="p-4 text-slate-700 bg-slate-50"><p>{management.message}</p><button type="button" disabled={management.busy} onClick={() => void management.recheck()} className="mt-2 underline">契約状態を再確認</button></div>}
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
                        月間上限: <span className="font-bold text-slate-800">{unlimited ? '上限なし' : monthlyLimit ?? '確認できません'}</span>{monthlyLimit === null || unlimited ? '' : ' 枚'} / 今月の残り: <span className="font-bold text-blue-600">{unlimited ? '上限なし' : remaining ?? '確認できません'}</span>{remaining === null ? '' : ' 枚'}
                      </p>
                    </div>

                    <div className="text-right">
                      {isPaid ? (
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-800">有料プラン</p>
                          <p className="text-xs text-slate-500">請求額は契約内容をご確認ください</p>
                        </div>
                      ) : (
                        <div className="text-3xl font-black text-slate-800 tracking-tighter">
                          ¥0<span className="text-sm text-slate-400 font-bold ml-1">/free</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {statsError && (
                    <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                      使用状況を取得できませんでした。時間をおいて再読み込みしてください。
                      <button type="button" onClick={() => window.location.reload()} className="ml-2 underline">再読み込み</button>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    {isGuest ? (
                      <Link
                        href={`/auth/signin?callbackUrl=${encodeURIComponent('/banner/dashboard/plan')}`}
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Sparkles className="w-5 h-5" />
                        ログインして利用を開始
                      </Link>
                    ) : isPaid ? (
                      <Link
                        href={HIGH_USAGE_CONTACT_URL || '/banner/pricing'}
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all shadow-xl shadow-slate-200"
                      >
                        <ArrowUpRight className="w-5 h-5" />
                        さらに上限UPの相談（丸投げ）
                      </Link>
                    ) : (
                      <CheckoutButton
                        planId="banner-pro"
                        loginCallbackUrl="/banner/dashboard/plan"
                        variant="secondary"
                        className="flex-1 inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-blue-600 text-white font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Zap className="w-5 h-5" />
                        プロにアップグレード
                      </CheckoutButton>
                    )}
                  </div>

                  {/* 決済済みなのに反映されない時の救済 */}
                  {!isGuest && !isPaid && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleSyncPlan}
                        disabled={syncDisabled}
                        aria-busy={isSyncingPlan}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-black hover:bg-slate-50 transition-colors disabled:opacity-60"
                      >
                        {isSyncingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        課金状態を確認してプランを反映する
                      </button>
                      <p className="mt-2 text-[11px] text-slate-500 font-bold">
                        ※ 決済直後にプランへ切り替わらない場合のみ押してください（Stripe→DBを再同期します）
                      </p>
                      {syncMessage && <p role="status" className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-950">{syncMessage}</p>}
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
                            停止日時までは有料プランの機能をご利用いただけます。
                          </p>
                          <button
                            onClick={handleResumeSubscription}
                            disabled={management.disabled}
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
                        disabled={management.disabled}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 font-black hover:bg-red-100 transition-colors disabled:opacity-60"
                      >
                        {isCanceling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        統一プランを解約する
                      </button>
                      <p className="mt-2 text-[11px] text-slate-500 font-bold">
                        ※ 解約は「次回更新日で停止」です（即時停止が必要な場合はお問い合わせください）
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 料金プラン（統一2プランUI） */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-8 border-b border-gray-100">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    料金プラン
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
                    用途に合わせてプランをお選びください
                  </p>
                </div>
                <div className="p-4 sm:p-8">
                  <UnifiedPricingPlans serviceId="banner" currentPlan={isGuest ? undefined : bannerPlanTier} />
                </div>
              </div>

              {/* Metrics（累計実績） */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-8">
                  <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="rounded-3xl border border-gray-100 p-4 sm:p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      </div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">推定削減時間</p>
                        <span className="relative group/tt">
                          <Info className="w-4 h-4 text-slate-400 cursor-help" aria-label="根拠" />
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-[220px] sm:w-[260px] max-w-[80vw] whitespace-pre-line rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-xl opacity-0 group-hover/tt:opacity-100 transition-opacity"
                          >
                            {estimateBasisText}
                          </span>
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter">
                        {totalBanners === null ? '—' : savedHours}<span className="text-sm text-slate-400 font-bold ml-1">{totalBanners === null ? '' : '時間'}</span>
                      </p>
                    </div>
                    <div className="rounded-3xl border border-gray-100 p-4 sm:p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                      </div>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">累計生成枚数</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter">
                        {totalBanners ?? '—'}<span className="text-sm text-slate-400 font-bold ml-1">{totalBanners === null ? '' : '枚'}</span>
                      </p>
                    </div>
                    <div className="rounded-3xl border border-gray-100 p-4 sm:p-6 bg-white hover:border-blue-100 hover:shadow-md transition-all group">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                      </div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">推定コスト削減</p>
                        <span className="relative group/tt">
                          <Info className="w-4 h-4 text-slate-400 cursor-help" aria-label="根拠" />
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-[220px] sm:w-[260px] max-w-[80vw] whitespace-pre-line rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-xl opacity-0 group-hover/tt:opacity-100 transition-opacity"
                          >
                            {estimateBasisText}
                          </span>
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter">
                        {totalBanners === null ? '—' : `¥${savedCost.toLocaleString()}`}
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
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">統一プランの解約を確認</h3><p className="text-sm text-slate-600 mb-3">解約は、すべての対象サービスに適用されます。</p>
                <div className="text-left rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6 space-y-2 text-sm font-bold text-slate-700">
                  <p>この操作はバナーだけの解約ではありません。このアカウントで確認された有効な有料契約をすべて、各契約の次回更新日で解約予約します。</p>
                  <p>停止後はドヤバナーを含む統一プラン対象サービスの有料枠・有料機能が使えなくなります。無料枠での利用は続けられます。</p>
                  <p>停止日時までは有料機能を利用できます。予約後の日時は契約画面で確認してください。</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
                  >
                    やっぱりプランを継続する
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={management.disabled}
                    className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCanceling && <Loader2 className="w-4 h-4 animate-spin" />}
                    有料契約を解約予約する
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
