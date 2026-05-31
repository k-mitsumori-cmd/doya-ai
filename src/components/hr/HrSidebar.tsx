'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Users2,
  Network,
  ClipboardList,
  MessageSquare,
  Settings,
  CreditCard,
  Tag,
  UserPlus,
  LayoutDashboard,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { hrTheme } from '@/components/sidebar/themes'
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

const HR_MAIN_NAV: NavItem[] = [
  { href: '/hr/employees/new', label: '従業員を追加', icon: UserPlus, hot: true },
  { href: '/hr/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/hr/employees', label: '従業員', icon: Users },
  { href: '/hr/org-chart', label: '組織図', icon: Network },
  { href: '/hr/evaluations', label: '評価', icon: ClipboardList },
]

const HR_ADMIN_NAV: NavItem[] = [
  { href: '/hr/settings', label: '設定', icon: Settings },
  { href: '/hr/settings/billing', label: '現在のプラン', icon: CreditCard },
  { href: '/hr/pricing', label: '料金プラン', icon: Tag },
]

interface HrSidebarProps extends SidebarProps {
  employeeCount?: number
  employeeLimit?: number
  plan?: string
}

function HrSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
  employeeCount = 0,
  employeeLimit = 5,
  plan,
}: HrSidebarProps) {
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

  // 請求ページ／使用量メーターと一致させるため、HR組織のプラン(plan prop)を優先表示する
  const planLabel = (() => {
    if (!plan && !isLoggedIn) return 'GUEST'
    const p = String(plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BUSINESS') return 'PRO'
    if (p === 'STARTER' || p === 'BASIC' || p === 'LIGHT') return 'STARTER'
    return 'FREE'
  })()

  const isActive = (href: string) => {
    if (href === '/hr/dashboard') return pathname === '/hr/dashboard'
    if (href === '/hr/settings') return pathname === '/hr/settings'
    // 「従業員」は /hr/employees とその詳細のみ。「従業員を追加」(/hr/employees/new) では光らせない
    if (href === '/hr/employees') {
      return (
        pathname === '/hr/employees' ||
        ((pathname?.startsWith('/hr/employees/') ?? false) && pathname !== '/hr/employees/new')
      )
    }
    return pathname?.startsWith(href) ?? false
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/hr?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  // usage API は無制限プランを -1 ではなく 999 で返すため、どちらも無制限として扱う
  const isUnlimited = employeeLimit === -1 || employeeLimit >= 999
  const usagePercent = isUnlimited
    ? 12
    : Math.min(100, Math.round((employeeCount / Math.max(employeeLimit, 1)) * 100))
  const nearLimit = !isUnlimited && employeeCount >= employeeLimit

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={hrTheme}>
        {/* ロゴ */}
        <div className="px-3 sm:px-4 py-4 flex items-center">
          {showLabel ? (
            <img src="/hr/logo.png" alt="ドヤHR" className="h-9 w-auto" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Users2 className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <div className="space-y-1">
              {HR_MAIN_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  showLabel={showLabel}
                  theme={hrTheme}
                  layoutId="hrActiveIndicator"
                />
              ))}
            </div>

            <div className="pt-4 mt-3 border-t border-white/10 space-y-1">
              <SidebarSectionTitle title="管理" isCollapsed={isCollapsed} theme={hrTheme} />
              {HR_ADMIN_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  showLabel={showLabel}
                  theme={hrTheme}
                  layoutId="hrActiveIndicator"
                />
              ))}
            </div>
          </nav>

          {/* 従業員数 / プラン案内バナー */}
          {(isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-white/90 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  従業員数
                </span>
                <span className="text-sm font-black text-white">
                  {employeeCount}
                  <span className="text-white/60 text-[11px]"> / {isUnlimited ? '∞' : employeeLimit}</span>
                </span>
              </div>
              <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${nearLimit ? 'bg-amber-300' : 'bg-white'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <Link
                href="/hr/pricing"
                className="block w-full py-2 bg-white text-blue-700 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md text-center"
              >
                {planLabel === 'PRO' || planLabel === 'ENTERPRISE'
                  ? 'プランを見る'
                  : nearLimit
                    ? '上限です・アップグレード'
                    : 'プランをアップグレード'}
              </Link>
            </div>
          )}
        </div>

        <ToolSwitcherMenu
          currentService="hr"
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
          theme={hrTheme}
          settingsHref="/hr/settings"
          loginCallbackUrl="/hr/dashboard"
          onLogout={() => setIsLogoutDialogOpen(true)}
          renderExtra={() => (
            <p className="text-[11px] font-bold text-white/60 truncate">
              {planLabel === 'GUEST' ? 'ゲスト' : `${planLabel} プラン`}
            </p>
          )}
        />
        <SidebarCollapseToggle
          isCollapsed={isCollapsed}
          onToggle={toggle}
          isMobile={isMobile}
          theme={hrTheme}
        />
        <SidebarBrandingFooter brandName="ドヤHR" isCollapsed={isCollapsed} theme={hrTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={hrTheme}
      />
    </>
  )
}

export default memo(HrSidebarImpl)
