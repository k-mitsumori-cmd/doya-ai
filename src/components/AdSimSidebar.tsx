'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Clock,
  CreditCard,
  BarChart3,
  LayoutTemplate,
  BookOpen,
  Plus,
  Zap,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { adsimTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarNavLink,
  SidebarSectionTitle,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarHelpContact,
  SidebarUserProfile,
  SidebarLogoutDialog,
  useSidebarState,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

const ADSIM_NAV: NavItem[] = [
  { href: '/adsim/new', label: '新規広告提案', icon: Plus, hot: true },
  { href: '/adsim', label: 'ダッシュボード', icon: LayoutTemplate },
  { href: '/adsim/history', label: '提案履歴', icon: Clock },
  { href: '/adsim/guide', label: '使い方ガイド', icon: BookOpen },
  { href: '/adsim/pricing', label: '料金プラン', icon: CreditCard },
]

function AdSimSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({
    controlledIsCollapsed,
    onToggle,
    forceExpanded,
    isMobile,
  })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const planLabel = (() => {
    if (!isLoggedIn) return 'GUEST'
    const p = String((session?.user as any)?.plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return 'PRO'
    if (p === 'LIGHT') return 'LIGHT'
    return 'FREE'
  })()

  const isActive = (href: string) => {
    if (href === '/adsim') return pathname === '/adsim'
    return pathname.startsWith(href)
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/adsim?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={adsimTheme}>
        <SidebarLogoSection icon={BarChart3} title="ドヤ広告シミュ" showLabel={showLabel} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <div className="space-y-1">
              <SidebarSectionTitle title="ドヤ広告シミュ" isCollapsed={isCollapsed} theme={adsimTheme} />
              {ADSIM_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  showLabel={showLabel}
                  theme={adsimTheme}
                  layoutId="adsimActiveIndicator"
                />
              ))}
            </div>
          </nav>

          {/* プランバナー */}
          {(isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
              <div className="hidden md:block relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Zap className="w-4 h-4 text-[#0017C1] fill-[#0017C1]" />
                  </div>
                  <p className="text-xs font-black text-white">プラン案内</p>
                </div>
                <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
                  現在: {planLabel === 'GUEST' ? 'ゲスト' : planLabel}
                </p>
                <p className="text-[10px] text-blue-100 font-bold leading-relaxed opacity-80">
                  {planLabel === 'LIGHT'
                    ? <>PROプラン: ¥9,980/月<TrialInlineSuffix /></>
                    : planLabel === 'PRO' || planLabel === 'ENTERPRISE'
                      ? '現在のプランで全機能利用可'
                      : <>ライトプラン: ¥2,980/月<TrialInlineSuffix /></>}
                </p>
                <Link
                  href="/adsim/pricing"
                  className="mt-3 w-full py-2 bg-white text-[#0017C1] text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md block text-center"
                >
                  {planLabel === 'PRO' || planLabel === 'ENTERPRISE'
                    ? 'プランを見る'
                    : planLabel === 'LIGHT'
                      ? 'PROにアップグレード'
                      : 'ライトを始める'}
                </Link>
              </div>
              <Link
                href="/adsim/pricing"
                className="md:hidden relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4 text-[#0017C1] fill-[#0017C1]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white font-bold leading-snug truncate">
                    {planLabel === 'GUEST' ? 'ゲスト' : planLabel} →{' '}
                    {planLabel === 'LIGHT' ? 'PRO' : 'LIGHT'}
                  </p>
                </div>
                <span className="flex-shrink-0 px-3 py-1.5 bg-white text-[#0017C1] text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md whitespace-nowrap">
                  UP
                </span>
              </Link>
            </div>
          )}
        </div>

        <ToolSwitcherMenu
          currentService="adsim"
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          className="px-3 sm:px-4 pb-2"
        />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={adsimTheme}
          loginCallbackUrl="/adsim"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle
          isCollapsed={isCollapsed}
          onToggle={toggle}
          isMobile={isMobile}
          theme={adsimTheme}
        />
        <SidebarBrandingFooter brandName="ドヤ広告シミュ" isCollapsed={isCollapsed} theme={adsimTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={adsimTheme}
      />
    </>
  )
}

export default memo(AdSimSidebarImpl)
