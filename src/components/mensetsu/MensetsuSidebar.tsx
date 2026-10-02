'use client'

// ドヤ面接官 サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。
//    独自のヘッダーやナビを作らないこと。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
import React, { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { UserCheck, Users, CreditCard, Settings } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { mensetsuTheme } from '@/components/sidebar/themes'
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
  SidebarUsagePanel,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

const BASE = '/mensetsu'

function MensetsuSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  // ⚠️ セッション確定前は plan が既定値になり、一瞬だけゲスト扱いの表示が出てしまう。
  //    表示だけを止める（fetch は止めない。Cookie認証なので未確定でも応答する）
  const sessionReady = sessionStatus !== 'loading'
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const NAV: NavItem[] = [
    { href: BASE, label: '面接を用意する', icon: UserCheck, hot: true },
    { href: BASE + '/compare', label: '候補者を比較', icon: Users },
    { href: BASE + '/settings', label: '設定', icon: Settings },
    { href: BASE + '/pricing', label: '料金プラン', icon: CreditCard },
  ]

  const isActive = (href: string) => {
    if (href === BASE) return pathname === BASE
    return pathname === href || pathname.startsWith(href + '/')
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: `${BASE}?loggedOut=1` })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={mensetsuTheme}>
        <SidebarLogoSection icon={UserCheck} title="ドヤ面接官" showLabel={showLabel} logoSrc="/mensetsu/logo-sidebar.png" logoClassName="w-full h-auto" logoAspect={{ width: 1997, height: 592 }} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ面接官" isCollapsed={isCollapsed} theme={mensetsuTheme} />
            {NAV.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={mensetsuTheme}
                layoutId="mensetsuActiveIndicator"
              />
            ))}
          </nav>

          {/* プラン案内。⚠️ 金額の正本は unified-plan.ts。ここに別の数字を書かない */}
          {/* 作った数と残り。数字は /api/usage/mensetsu から受け取るだけ */}
          <SidebarUsagePanel service="mensetsu" show={sessionReady && (isMobile || !isCollapsed)} pricingHref="/mensetsu/pricing" />
        </div>

        <ToolSwitcherMenu currentService="mensetsu" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={mensetsuTheme}
          loginCallbackUrl="/mensetsu"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={mensetsuTheme} />
        <SidebarBrandingFooter brandName="ドヤ面接官" isCollapsed={isCollapsed} theme={mensetsuTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={mensetsuTheme}
      />
    </>
  )
}

export default memo(MensetsuSidebarImpl)
