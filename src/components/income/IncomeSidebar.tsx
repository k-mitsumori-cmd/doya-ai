'use client'

// ドヤ収入管理 サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
// ⚠️ 項目は src/lib/income/nav.ts を描くだけ（ADDON-SERVICES R-1 / D-1）。ここに項目を書き足さない。
//    AppShell（段 0）が main に入ったら、このファイルごと消して AppShell に載せる。
import React, { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BadgeJapaneseYen } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { incomeTheme } from '@/components/sidebar/themes'
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
import { UiIcon } from '@/components/icons'
import { INCOME_NAV, activeNavHref, type IncomeNavItem } from '@/lib/income/nav'

const BASE = '/income'

/** nav.ts の 1 項目を共通サイドバーの NavItem に変える */
function toNavItem(n: IncomeNavItem): NavItem {
  const Icon = (props: { className?: string }) => <UiIcon name={n.icon} size={20} className={props.className} />
  return { href: n.href, label: n.label, icon: Icon }
}
const NAV: NavItem[] = INCOME_NAV.filter((n) => n.group === 'main').map(toNavItem)
const NAV_SETTINGS: NavItem[] = INCOME_NAV.filter((n) => n.group === 'settings').map(toNavItem)

function IncomeSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isActive = (href: string) => activeNavHref(pathname) === href

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

  const renderNav = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={incomeTheme} layoutId="incomeActiveIndicator" />
    ))

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={incomeTheme}>
        <SidebarLogoSection icon={BadgeJapaneseYen} title="ドヤ収入管理" showLabel={showLabel} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ収入管理" isCollapsed={isCollapsed} theme={incomeTheme} />
            {renderNav(NAV)}
            <SidebarSectionTitle title="設定" isCollapsed={isCollapsed} theme={incomeTheme} />
            {renderNav(NAV_SETTINGS)}
          </nav>
        </div>

        <ToolSwitcherMenu currentService="income" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={incomeTheme}
          loginCallbackUrl="/income"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={incomeTheme} />
        <SidebarBrandingFooter brandName="ドヤ収入管理" isCollapsed={isCollapsed} theme={incomeTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={incomeTheme}
      />
    </>
  )
}

export default memo(IncomeSidebarImpl)
