'use client'

import React, { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Send,
  LayoutDashboard,
  Plus,
  LayoutTemplate,
  CreditCard,
  Zap,
  Loader2,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { interviewxTheme } from '@/components/sidebar/themes'
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

const NAV_ITEMS: NavItem[] = [
  { href: '/interviewx', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/interviewx/new', label: '新規作成', icon: Plus },
  { href: '/interviewx/templates', label: 'テンプレート', icon: LayoutTemplate },
  { href: '/interviewx/pricing', label: '料金プラン', icon: CreditCard },
]

function InterviewXSidebarImpl({
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

  const planLabel = useMemo(() => {
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (['ENTERPRISE', 'PRO', 'LIGHT', 'FREE'].includes(p)) return p
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const nextPlanLabel = useMemo(() => {
    if (planLabel === 'GUEST' || planLabel === 'FREE') return 'LIGHT'
    if (planLabel === 'LIGHT') return 'PRO'
    if (planLabel === 'PRO') return 'ENTERPRISE'
    return null
  }, [planLabel])

  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const { isFreeHourActive, freeHourRemainingMs } = useFreeHour(firstLoginAt)

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      markLogoutToastPending()
      await signOut({ callbackUrl: '/interviewx?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const handleUpgrade = async (planId: string) => {
    if (!isLoggedIn) {
      router.push(`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/interviewx')}`)
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
      if (data.url) window.location.href = data.url
    } catch (e) {
      console.error('Checkout error:', e)
    } finally {
      setIsUpgrading(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/interviewx') return pathname === '/interviewx'
    return pathname?.startsWith(href)
  }

  const GuestPromo = () => {
    if (isLoggedIn || !showLabel) return null
    return (
      <div className="mx-3 mb-2">
        <Link
          href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/interviewx')}`}
          className="block p-3 rounded-xl bg-gradient-to-r from-indigo-400 to-violet-400 relative overflow-hidden shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Zap className="w-4 h-4 text-indigo-500" />
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

  const PlanBanner = () => {
    if (isFreeHourActive && freeHourRemainingMs > 0) return null
    if (!showLabel || !isLoggedIn || !nextPlanLabel) return null

    return (
      <div className="mx-3 mb-2">
        <button
          onClick={() => handleUpgrade(nextPlanLabel === 'LIGHT' ? 'interviewx-light' : nextPlanLabel === 'PRO' ? 'interviewx-pro' : 'interviewx-enterprise')}
          disabled={isUpgrading}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-60"
        >
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            {isUpgrading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Zap className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-black text-white">{nextPlanLabel}にアップグレード</p>
            <p className="text-[9px] text-white/50 font-bold">
              {nextPlanLabel === 'LIGHT' ? '月額¥2,980' : nextPlanLabel === 'PRO' ? '月額¥9,980' : '月額¥49,800'}
            </p>
          </div>
        </button>
      </div>
    )
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={interviewxTheme}>
        <SidebarLogoSection icon={Send} title="ドヤヒヤリングAI" subtitle="PROJECT MANAGEMENT" subtitleClassName="text-indigo-100/50 uppercase tracking-wider text-[9px]" showLabel={showLabel} />

        <div className="flex-1 overflow-y-auto">
          <nav className="py-4 px-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href) ?? false}
                showLabel={showLabel}
                theme={interviewxTheme}
                layoutId="interviewxActiveIndicator"
              />
            ))}
          </nav>

          {isFreeHourActive && (
            <SidebarFreeHourBanner freeHourRemainingMs={freeHourRemainingMs} isCollapsed={isCollapsed} isMobile={isMobile} />
          )}

          <GuestPromo />
          <PlanBanner />
        </div>

        <ToolSwitcherMenu currentService="interviewx" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 pb-2" />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={interviewxTheme}
          settingsHref="/interviewx"
          loginCallbackUrl={pathname || '/interviewx'}
          onLogout={() => setIsLogoutDialogOpen(true)}
          renderExtra={() => (
            <p className="text-[10px] font-bold text-indigo-100/60 truncate">
              {planLabel === 'GUEST' ? 'ゲスト' : `${planLabel}プラン`}
            </p>
          )}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={interviewxTheme} />
        <SidebarBrandingFooter brandName="ドヤヒヤリングAI" isCollapsed={isCollapsed} theme={interviewxTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={interviewxTheme}
      />
    </>
  )
}

export default memo(InterviewXSidebarImpl)
