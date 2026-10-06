'use client'

import React, { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  BookOpen,
  Zap,
  FolderOpen,
  Settings,
  LayoutTemplate,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { HIGH_USAGE_CONTACT_URL, INTERVIEW_PRICING } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'
import { UNIFIED_PRO_PLAN_ID, UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'
import { CheckoutButton } from '@/components/CheckoutButton'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { interviewTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarNavLink,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarUserProfile,
  SidebarLogoutDialog,
  useSidebarState,
} from '@/components/sidebar'
import { useInterviewUsage } from './useInterviewUsage'
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
  const { usage, failed, refresh } = useInterviewUsage()
  const usedMinutes = usage?.usedMinutes ?? 0
  const reservedMinutes = usage?.reservedMinutes ?? 0
  const limitMinutes = usage?.limitMinutes ?? 0
  const loaded = Boolean(usage)
  const pct = limitMinutes > 0 ? Math.min(((usedMinutes + reservedMinutes) / limitMinutes) * 100, 100) : 0
  const isNearLimit = pct >= 80
  const remainingMinutes = limitMinutes === -1 ? -1 : Math.max(limitMinutes - usedMinutes - reservedMinutes, 0)

  // 折りたたみ時: コンパクトアイコン
  if (isCollapsed && !showLabel) {
    if (!isLoggedIn) return null
    return (
      <div className="flex justify-center mb-2" title={loaded ? `残り ${remainingMinutes === -1 ? '無制限' : `${remainingMinutes}分`}` : failed ? '利用状況は未確認です' : '文字起こし利用状況'}>
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
            {loaded && limitMinutes >= 0 && (
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
            {loaded && reservedMinutes > 0 && <p className="text-[10px] text-white/70 font-bold">処理中{reservedMinutes}分は予約済みです。</p>}
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
                {failed ? <p className="text-[10px] text-white/70">利用状況を取得できませんでした。残り枠は未確認です。<button type="button" onClick={refresh} className="ml-1 underline">再取得する</button></p>
                  : <span className="material-symbols-outlined text-white/30 text-sm animate-spin">sync</span>}
              </div>
            )}
            {loaded && remainingMinutes === 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-red-300 font-bold">
                <span className="material-symbols-outlined text-xs">warning</span>
                <span>{reservedMinutes > 0 ? '処理中の予約分を含め、利用枠の上限に達しました。' : '利用枠の上限に達しました。'}<Link href={planLabel === 'PRO' || planLabel === 'ENTERPRISE' ? HIGH_USAGE_CONTACT_URL : '/interview/pricing'} className="ml-1 underline">{planLabel === 'PRO' || planLabel === 'ENTERPRISE' ? '追加の利用枠を相談する' : 'プランと利用枠を確認する'}</Link></span>
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
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // プラン判定
  const planLabel = useMemo(() => {
    if (!isLoggedIn) return 'GUEST'
    return higherPlan((session?.user as any)?.interviewPlan, (session?.user as any)?.plan)
  }, [session, isLoggedIn])

  const nextPlanLabel = useMemo(() => {
    return planLabel === 'FREE' || planLabel === 'LIGHT' ? 'PRO' : 'CONSULT'
  }, [planLabel])

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
          href={`/auth/signin?callbackUrl=${encodeURIComponent('/interview')}`}
          className="block p-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 relative overflow-hidden shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white drop-shadow-sm">無料登録で記事生成1日5回</p>
              <p className="text-[10px] text-white/80 font-bold">Googleアカウントで10秒</p>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  // プランアップグレードバナー（ログインユーザー向け）
  const PlanBanner = () => {
    if (!showLabel || !isLoggedIn) return null
    if (planLabel === 'ENTERPRISE') return null

    return (
      <div className="mx-3 mb-2">
        {nextPlanLabel === 'CONSULT' ? (
          <a
            href={HIGH_USAGE_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white">利用枠の追加を相談</p>
            </div>
          </a>
        ) : (
          <CheckoutButton
            planId={UNIFIED_PRO_PLAN_ID}
            variant="secondary"
            className="w-full p-2.5 bg-white/10 border border-white/10 hover:bg-white/15"
          >
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[11px] font-black text-white">PROにアップグレード</p>
              <p className="text-[9px] text-white/50 font-bold">
                月額{UNIFIED_PRO_PRICE_LABEL}<TrialInlineSuffix />
              </p>
            </div>
          </CheckoutButton>
        )}
      </div>
    )
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={interviewTheme}>
        <SidebarLogoSection icon={Mic} title="ドヤインタビューAI" subtitle="AI記事生成" subtitleClassName="text-purple-100/70" showLabel={showLabel} />

        {/* スクロール可能な領域: ナビ + 使用量 + バナー + プロモをまとめる */}
        <div className="flex-1 overflow-y-auto">
          <nav className="py-4 px-3 space-y-1">
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

          {/* ゲスト向け登録プロモ */}
          <GuestPromo />

          {/* プランアップグレード */}
          <PlanBanner />
        </div>

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


    </>
  )
}

export default memo(InterviewSidebarImpl)
