'use client'

// ドヤ支出管理 サイドバー（共通サイドバー部品で組む。ToolSwitcherMenu 必須）
import React, { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { asklinkTheme as expenseTheme } from '@/components/sidebar/themes'
import { EXPENSE_NAV, expenseNavHref } from '@/lib/expense/nav'
import { ROLE_RANK, type ExpenseRole } from '@/lib/expense/constants'
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

function ExpenseSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile, orgSlug, role }: SidebarProps & { orgSlug: string; role: ExpenseRole | null }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const base = `/expense/${orgSlug}`

  // ナビ項目は src/lib/expense/nav.ts の EXPENSE_NAV だけを描く（権限が足りない項目は隠す）
  const NAV: NavItem[] = EXPENSE_NAV.filter((i) => !i.minServiceRole || (role && ROLE_RANK[role] >= ROLE_RANK[i.minServiceRole])).map((i) => ({
    href: expenseNavHref(i, orgSlug),
    label: i.label,
    icon: i.icon,
  }))

  const isActive = (href: string) => (href === base ? pathname === base : pathname === href || pathname.startsWith(href + '/'))

  const confirmLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/expense?loggedOut=1' })
    } finally {
      setLoggingOut(false)
      setLogoutOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={expenseTheme}>
        <SidebarLogoSection icon={Wallet} title="ドヤ支出管理" showLabel={showLabel} />
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="space-y-1 px-3 py-4 sm:py-6">
            <SidebarSectionTitle title="ドヤ支出管理" isCollapsed={isCollapsed} theme={expenseTheme} />
            {NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={expenseTheme} layoutId="expenseActiveIndicator" />
            ))}
          </nav>
        </div>
        <ToolSwitcherMenu currentService="expense" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 pb-2 sm:px-4" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={expenseTheme}
          loginCallbackUrl="/expense"
          onLogout={() => setLogoutOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={expenseTheme} />
        <SidebarBrandingFooter brandName="ドヤ支出管理" isCollapsed={isCollapsed} theme={expenseTheme} />
      </SidebarShell>
      <SidebarLogoutDialog isOpen={logoutOpen} isLoggingOut={loggingOut} onClose={() => setLogoutOpen(false)} onConfirm={() => void confirmLogout()} theme={expenseTheme} />
    </>
  )
}

export default memo(ExpenseSidebarImpl)
