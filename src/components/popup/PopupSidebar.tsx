'use client'

// ドヤポップアップ サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。
//    独自のヘッダーやナビを作らないこと。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelTopOpen, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { popupTheme } from '@/components/sidebar/themes'
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
import { getServiceById } from '@/lib/services'
import { POPUP_NAV, isPopupNavActive } from '@/lib/popup/nav'
import { resolveShellIcon } from '@/components/shell/icons'

const BASE = '/popup'

function PopupSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  // ⚠️ セッション確定前は plan が既定値になり、一瞬だけゲスト扱いの表示が出てしまう。
  //    表示だけを止める（fetch は止めない。Cookie認証なので未確定でも応答する）
  const sessionReady = sessionStatus !== 'loading'
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // ⚠️ 項目は src/lib/popup/nav.ts が正本（統合仕様 R-1）。ここでは描くだけ
  const NAV: NavItem[] = POPUP_NAV.map((item, i) => ({ href: item.href, label: item.label, icon: item.icon ? resolveShellIcon(item.icon) : PanelTopOpen, hot: i === 0 }))

  const planLabel = (() => {
    if (!isLoggedIn) return 'GUEST'
    const p = String((session?.user as any)?.plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (['PRO', 'BASIC', 'STARTER', 'BUSINESS', 'BUNDLE'].includes(p)) return 'PRO'
    if (p === 'LIGHT') return 'LIGHT'
    return 'FREE'
  })()
  const isPro = planLabel === 'PRO' || planLabel === 'ENTERPRISE'

  const isActive = (href: string) => {
    const item = POPUP_NAV.find((n) => n.href === href)
    return item ? isPopupNavActive(item, pathname || '') : false
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
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={popupTheme}>
        <SidebarLogoSection icon={PanelTopOpen} title="ドヤポップアップ" showLabel={showLabel} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤポップアップ" isCollapsed={isCollapsed} theme={popupTheme} />
            {NAV.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={popupTheme}
                layoutId="popupActiveIndicator"
              />
            ))}
          </nav>

          {/* 作った数と残り。数字は /api/usage/popup から受け取るだけ */}
          <SidebarUsagePanel service="popup" show={sessionReady && (isMobile || !isCollapsed)} refreshEvent="popup:generated" />

          {/* プラン案内。⚠️ 金額の正本は unified-plan.ts。回数の文言は services.ts（plan-limit.ts と一致させてある） */}
          {sessionReady && !isPro && (isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-xs font-black text-white">現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}</p>
              </div>
              <p className="text-[10px] text-white/85 font-bold leading-relaxed mb-2">
                プロプラン ¥9,980/月で{getServiceById('popup')?.pricing.pro.limit}<TrialInlineSuffix />
              </p>
              <Link
                href="/popup/pricing"
                className="block w-full py-2 bg-white text-slate-800 text-[11px] font-black rounded-lg text-center shadow-md transition-colors hover:bg-slate-50"
              >
                プロにアップグレード
              </Link>
            </div>
          )}
        </div>

        <ToolSwitcherMenu currentService="popup" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={popupTheme}
          loginCallbackUrl="/popup"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={popupTheme} />
        <SidebarBrandingFooter brandName="ドヤポップアップ" isCollapsed={isCollapsed} theme={popupTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={popupTheme}
      />
    </>
  )
}

export default memo(PopupSidebarImpl)
