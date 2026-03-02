'use client'

import React, { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  BookOpen,
  Zap,
  Loader2,
  FolderOpen,
  Settings,
  LayoutTemplate,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { SUPPORT_CONTACT_URL, INTERVIEW_PRICING } from '@/lib/pricing'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { interviewTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarNavLink,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarUserProfile,
  SidebarLogoutDialog,
  SidebarFreeHourBanner,
  useSidebarState,
  useFreeHour,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'

const INTERVIEW_NAV: NavItem[] = [
  { href: '/interview', label: '記事作成', icon: Mic },
  { href: '/interview/projects', label: '記事一覧', icon: FolderOpen },
  { href: '/interview/templates', label: 'テンプレート', icon: LayoutTemplate },
  { href: '/interview/skills', label: 'スキル', icon: BookOpen },
  { href: '/interview/settings', label: '設定', icon: Settings },
]

// 利用分数表示コンポーネント（Interview固有）
function UsageStats({ showLabel, isLoggedIn, planLabel, isCollapsed }: { showLabel: boolean; isLoggedIn: boolean; planLabel: string; isCollapsed: boolean }) {
  const [usedMinutes, setUsedMinutes] = useState(0)
  const [limitMinutes, setLimitMinutes] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/interview/usage')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUsedMinutes(data.usedMinutes || 0)
          setLimitMinutes(data.limitMinutes || 0)
          setLoaded(true)
        }
      })
      .catch(() => {})
  }, [isLoggedIn])

  const pct = limitMinutes > 0 ? Math.min((usedMinutes / limitMinutes) * 100, 100) : 0
  const isNearLimit = pct >= 80
  const remainingMinutes = limitMinutes > 0 ? Math.max(limitMinutes - usedMinutes, 0) : -1

  // 折りたたみ時: コンパクトアイコン
  if (isCollapsed && !showLabel) {
    if (!isLoggedIn) return null
    return (
      <div className="flex justify-center mb-2" title={loaded ? `残り ${remainingMinutes === -1 ? '無制限' : `${remainingMinutes}分`}` : '文字起こし利用状況'}>
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${
          loaded && remainingMinutes === 0 ? 'bg-red-500/20' : isNearLimit ? 'bg-amber-500/20' : 'bg-white/10'
        }`}>
          <span className={`material-symbols-outlined text-lg ${
            loaded && remainingMinutes === 0 ? 'text-red-300' : isNearLimit ? 'text-amber-300' : 'text-white/70'
          }`}>timer</span>
          {loaded && remainingMinutes !== -1 && (
            <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center px-1 ${
              remainingMinutes === 0 ? 'bg-red-500 text-white' : isNearLimit ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white'
            }`}>
              {remainingMinutes}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ゲスト向け: 制限情報のみ
  if (!isLoggedIn && showLabel) {
    return (
      <div className="mx-3 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">文字起こし</p>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-white/70 font-bold">
            <span className="material-symbols-outlined text-sm text-white/50">timer</span>
            <span>ゲスト: <span className="text-white font-black">{INTERVIEW_PRICING.transcriptionMinutes.guest}分</span> まで</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-amber-300/80 font-bold">
            <span className="material-symbols-outlined text-[10px]">star</span>
            <span>無料登録で{INTERVIEW_PRICING.transcriptionMinutes.free}分/月に拡大</span>
          </div>
        </div>
      </div>
    )
  }

  if (!showLabel || !isLoggedIn) return null

  // 円形ゲージ用の計算
  const gaugeRadius = 36
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const gaugeOffset = gaugeCircumference - (pct / 100) * gaugeCircumference
  const gaugeColor = remainingMinutes === 0 ? '#f87171' : isNearLimit ? '#fbbf24' : '#a855f7'
  const gaugeBgColor = 'rgba(255,255,255,0.1)'

  return (
    <AnimatePresence>
      {showLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mx-3 mb-2"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">文字起こし利用状況</p>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
            {/* 円形ゲージメーター */}
            {loaded && limitMinutes > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40" cy="40" r={gaugeRadius}
                      fill="none"
                      stroke={gaugeBgColor}
                      strokeWidth="5"
                    />
                    <motion.circle
                      cx="40" cy="40" r={gaugeRadius}
                      fill="none"
                      stroke={gaugeColor}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={gaugeCircumference}
                      initial={{ strokeDashoffset: gaugeCircumference }}
                      animate={{ strokeDashoffset: gaugeOffset }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-base font-black tabular-nums leading-none ${
                      remainingMinutes === 0 ? 'text-red-300' : isNearLimit ? 'text-amber-300' : 'text-white'
                    }`}>
                      {remainingMinutes === -1 ? '∞' : remainingMinutes}
                    </span>
                    <span className="text-[8px] text-white/50 font-bold mt-0.5">分 残り</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-[11px] text-white/60 font-bold">今月の使用量</div>
                  <div className={`text-sm font-black tabular-nums ${isNearLimit ? 'text-amber-300' : 'text-white/90'}`}>
                    {usedMinutes}<span className="text-[10px] text-white/50 font-bold"> / {limitMinutes}分</span>
                  </div>
                  <div className="text-[10px] text-white/30 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                    毎月リセット
                  </div>
                </div>
              </div>
            )}
            {/* 無制限の場合 */}
            {loaded && limitMinutes === -1 && (
              <div className="flex items-center gap-2 px-2 py-2">
                <span className="material-symbols-outlined text-lg text-[#a855f7]">all_inclusive</span>
                <span className="text-sm font-black text-white">無制限</span>
              </div>
            )}
            {/* ロード中 */}
            {!loaded && (
              <div className="flex items-center justify-center py-4">
                <span className="material-symbols-outlined text-white/30 text-sm animate-spin">sync</span>
              </div>
            )}
            {loaded && remainingMinutes === 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-red-300 font-bold">
                <span className="material-symbols-outlined text-xs">warning</span>
                <span>上限に達しました。プランをアップグレードしてください。</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function InterviewSidebarImpl({
  isMobile,
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [showTrialEndModal, setShowTrialEndModal] = useState(false)

  // プラン判定
  const planLabel = useMemo(() => {
    const interviewPlan = String((session?.user as any)?.interviewPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = interviewPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const nextPlanLabel = useMemo(() => {
    if (planLabel === 'GUEST' || planLabel === 'FREE') return 'PRO'
    if (planLabel === 'PRO') return 'ENTERPRISE'
    return 'CONSULT'
  }, [planLabel])

  // 1時間生成し放題
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const { isFreeHourActive, freeHourRemainingMs } = useFreeHour(firstLoginAt)

  // トライアル終了時にアップセルモーダルを表示
  useEffect(() => {
    if (isFreeHourActive && freeHourRemainingMs <= 0) {
      setShowTrialEndModal(true)
    }
  }, [isFreeHourActive, freeHourRemainingMs])

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      markLogoutToastPending()
      await signOut({ callbackUrl: '/interview/projects?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  // Stripe Checkout へ遷移
  const handleUpgrade = async (planId: string) => {
    if (!isLoggedIn) {
      router.push(`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/interview/projects')}`)
      return
    }
    setIsUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod: 'monthly' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e) {
      console.error('Checkout error:', e)
    } finally {
      setIsUpgrading(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/interview') return pathname === '/interview'
    if (href === '/interview/projects') return pathname === '/interview/projects' || pathname?.startsWith('/interview/projects/')
    return pathname?.startsWith(href)
  }

  // ゲスト向け「無料登録」バナー
  const GuestPromo = () => {
    if (isLoggedIn || !showLabel) return null

    return (
      <div className="mx-3 mb-2">
        <Link
          href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/interview')}`}
          className="block p-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 relative overflow-hidden shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white drop-shadow-sm">無料登録で1時間使い放題</p>
              <p className="text-[10px] text-white/80 font-bold">Googleアカウントで10秒</p>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  // プランアップグレードバナー（ログインユーザー向け）
  const PlanBanner = () => {
    if (isFreeHourActive && freeHourRemainingMs > 0) return null
    if (!showLabel || !isLoggedIn) return null
    if (planLabel === 'ENTERPRISE') return null

    return (
      <div className="mx-3 mb-2">
        {nextPlanLabel === 'CONSULT' ? (
          <a
            href={SUPPORT_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white">上限UP相談</p>
            </div>
          </a>
        ) : (
          <button
            onClick={() => handleUpgrade(nextPlanLabel === 'PRO' ? 'interview-pro' : 'interview-enterprise')}
            disabled={isUpgrading}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-60"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              {isUpgrading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Zap className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[11px] font-black text-white">{nextPlanLabel}にアップグレード</p>
              <p className="text-[9px] text-white/50 font-bold">
                {nextPlanLabel === 'PRO' ? '月額¥9,980' : '月額¥49,980'}
              </p>
            </div>
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={interviewTheme}>
        <SidebarLogoSection icon={Mic} title="ドヤインタビューAI" subtitle="AI記事生成" subtitleClassName="text-purple-100/70" showLabel={showLabel} />

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {INTERVIEW_NAV.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              showLabel={showLabel}
              theme={interviewTheme}
              layoutId="interviewActiveIndicator"
            />
          ))}
        </nav>

        {/* Usage Stats */}
        <UsageStats showLabel={showLabel} isLoggedIn={isLoggedIn} planLabel={planLabel} isCollapsed={isCollapsed} />

        {/* 1時間生成し放題バナー */}
        {isFreeHourActive && (
          <SidebarFreeHourBanner freeHourRemainingMs={freeHourRemainingMs} isCollapsed={isCollapsed} isMobile={isMobile} />
        )}

        {/* トライアル中PRO機能バッジ */}
        {isFreeHourActive && freeHourRemainingMs > 0 && showLabel && (
          <div className="mx-3 mb-2 flex flex-wrap gap-1.5">
            {['ファクトチェック', '翻訳', 'SNS生成'].map(f => (
              <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                <span className="material-symbols-outlined text-[10px]">workspace_premium</span>
                {f}
              </span>
            ))}
          </div>
        )}

        {/* ゲスト向け登録プロモ */}
        <GuestPromo />

        {/* プランアップグレード */}
        <PlanBanner />

        <ToolSwitcherMenu currentService="interview" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 pb-2" />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={interviewTheme}
          settingsHref="/interview/settings"
          loginCallbackUrl={pathname || '/interview/projects'}
          onLogout={() => setIsLogoutDialogOpen(true)}
          renderExtra={() => (
            <p className="text-[10px] font-bold text-purple-100/60 truncate">
              {planLabel === 'GUEST'
                ? `ゲスト（${INTERVIEW_PRICING.transcriptionMinutes.guest}分まで）`
                : planLabel === 'FREE'
                  ? `無料プラン（月${INTERVIEW_PRICING.transcriptionMinutes.free}分）`
                  : planLabel === 'PRO'
                    ? `PROプラン（月${INTERVIEW_PRICING.transcriptionMinutes.pro}分）`
                    : planLabel === 'ENTERPRISE'
                      ? `法人プラン（月${INTERVIEW_PRICING.transcriptionMinutes.enterprise}分）`
                      : `${planLabel}プラン`}
            </p>
          )}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={interviewTheme} />
        <SidebarBrandingFooter brandName="ドヤインタビューAI" isCollapsed={isCollapsed} theme={interviewTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={interviewTheme}
      />

      {/* トライアル終了アップセルモーダル */}
      <AnimatePresence>
        {showTrialEndModal && (
          <motion.div
            key="trial-end-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTrialEndModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#7f19e6]/10 via-blue-500/5 to-transparent pointer-events-none" />
              <div className="relative p-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.15, damping: 15 }}
                  className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-5 bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
                >
                  <span className="material-symbols-outlined text-white text-[40px]">timer_off</span>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-center mb-6">
                  <h2 className="text-xl font-black text-slate-900 mb-2">トライアル期間が終了しました</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">1時間の無料体験お疲れさまでした！PROプランにアップグレードすると、すべての機能を引き続きご利用いただけます。</p>
                </motion.div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[16px] text-[#7f19e6]">workspace_premium</span>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">PROプランの機能</span>
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      { icon: 'mic', text: '毎月150分まで文字起こし' },
                      { icon: 'fact_check', text: 'ファクトチェック・校正' },
                      { icon: 'translate', text: '10言語への翻訳' },
                      { icon: 'share', text: 'SNS投稿文の自動生成' },
                    ].map((f, i) => (
                      <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.07 }} className="flex items-center gap-3 p-2 rounded-xl bg-white">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#7f19e6] text-white shrink-0">
                          <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{f.text}</span>
                        <span className="material-symbols-outlined text-[16px] ml-auto text-[#7f19e6]">check_circle</span>
                      </motion.li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-3 border-t border-slate-200 text-center">
                    <span className="text-lg font-black text-[#7f19e6]">¥9,980</span>
                    <span className="text-xs text-slate-500">　/月</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    onClick={() => { setShowTrialEndModal(false); handleUpgrade('interview-pro') }}
                    className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-[#7f19e6] to-blue-600 hover:from-[#152e70] hover:to-blue-700 shadow-lg shadow-[#7f19e6]/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                      PROプランにアップグレード
                    </span>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    onClick={() => setShowTrialEndModal(false)}
                    className="w-full py-3 px-6 rounded-2xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    無料プランで続ける
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default memo(InterviewSidebarImpl)
