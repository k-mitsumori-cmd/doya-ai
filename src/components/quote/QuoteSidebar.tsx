'use client'

// ドヤ見積もりAI サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。
//    独自のヘッダーやナビを作らないこと。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
import React, { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Receipt, Settings, CreditCard } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { quoteTheme } from '@/components/sidebar/themes'
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
import { QUOTE_NAV } from '@/lib/quote/nav'
import { useQuoteUsageOrganization } from '@/lib/quote/use-usage-organization'

const BASE = '/quote'

// nav.ts の icon（名前の文字列）を部品に引く。共通の対応表（shell/icons）と同じ名前を使う
const NAV_ICONS: Record<string, React.ElementType> = { Receipt, Settings, CreditCard }

function QuoteSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  const organizationSlug = useQuoteUsageOrganization(session?.user?.id || '', sessionStatus)
  // ⚠️ セッション確定前は plan が既定値になり、一瞬だけゲスト扱いの表示が出てしまう。
  //    表示だけを止める（fetch は止めない。Cookie認証なので未確定でも応答する）
  const sessionReady = sessionStatus !== 'loading'
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // ⚠️ ナビの正本は src/lib/quote/nav.ts（共通の枠と同じ配列）
  const NAV: NavItem[] = QUOTE_NAV.map((item) => ({ href: item.href, label: item.label, icon: NAV_ICONS[item.icon ?? ''] ?? Receipt, ...(item.href === BASE ? { hot: true } : {}) }))

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
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={quoteTheme}>
        <SidebarLogoSection icon={Receipt} title="ドヤ見積もりAI" showLabel={showLabel} logoSrc="/quote/logo-sidebar.png" logoClassName="w-full h-auto" logoAspect={{ width: 1997, height: 558 }} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ見積もりAI" isCollapsed={isCollapsed} theme={quoteTheme} />
            {NAV.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={quoteTheme}
                layoutId="quoteActiveIndicator"
              />
            ))}
          </nav>

          {/* プラン案内。⚠️ 金額の正本は unified-plan.ts。ここに別の数字を書かない */}
          {/* 作った数と残り。数字は /api/usage/quote から受け取るだけ */}
          <SidebarUsagePanel service="quote" refreshEvent="quote:usage-changed" organizationSlug={organizationSlug} show={sessionReady && (isMobile || !isCollapsed)} pricingHref="/quote/pricing" />
        </div>

        <ToolSwitcherMenu currentService="quote" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={quoteTheme}
          loginCallbackUrl="/quote"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={quoteTheme} />
        <SidebarBrandingFooter brandName="ドヤ見積もりAI" isCollapsed={isCollapsed} theme={quoteTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={quoteTheme}
      />
    </>
  )
}

export default memo(QuoteSidebarImpl)
