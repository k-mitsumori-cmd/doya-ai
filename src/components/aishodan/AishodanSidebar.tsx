'use client'

// ドヤAI商談 サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。
//    独自のヘッダーやナビを作らないこと。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
import React, { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessagesSquare, DoorOpen, ClipboardList, CreditCard, Settings } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { aishodanTheme } from '@/components/sidebar/themes'
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

const BASE = '/aishodan'

function AishodanSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
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
    { href: BASE, label: 'ホーム', icon: MessagesSquare, hot: true },
    { href: BASE + '/sessions', label: '商談ログ', icon: ClipboardList },
    { href: BASE + '/preview', label: '練習モード', icon: DoorOpen },
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
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={aishodanTheme}>
        <SidebarLogoSection icon={MessagesSquare} title="ドヤAI商談" showLabel={showLabel} logoSrc="/aishodan/logo-sidebar.png" logoClassName="w-full h-auto" logoAspect={{ width: 1966, height: 568 }} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤAI商談" isCollapsed={isCollapsed} theme={aishodanTheme} />
            {NAV.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={aishodanTheme}
                layoutId="aishodanActiveIndicator"
              />
            ))}
          </nav>

          {/* プラン案内。⚠️ 金額の正本は unified-plan.ts。ここに別の数字を書かない */}
          {/* 作った数と残り。数字は /api/usage/aishodan から受け取るだけ */}
          <SidebarUsagePanel service="aishodan" show={sessionReady && (isMobile || !isCollapsed)} pricingHref="/aishodan/pricing" />
        </div>

        <ToolSwitcherMenu currentService="aishodan" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={aishodanTheme}
          loginCallbackUrl="/aishodan"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={aishodanTheme} />
        <SidebarBrandingFooter brandName="ドヤAI商談" isCollapsed={isCollapsed} theme={aishodanTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={aishodanTheme}
      />
    </>
  )
}

export default memo(AishodanSidebarImpl)
