'use client'

// ドヤ社内インタビュー サイドバー
// ⚠️ 共通サイドバー部品（src/components/sidebar/）で組む。
//    独自のヘッダーやナビを作らないこと。reference/06-ui-patterns.md §7 が正本。
// ⚠️ ToolSwitcherMenu を必ず含める（他サービスへ移れなくなる）。
import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookUser, Building2, CreditCard, Plus, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { shanaiTheme } from '@/components/sidebar/themes'
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

const BASE = '/shanai'

function ShanaiSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
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
    { href: BASE, label: 'インタビュー一覧', icon: BookUser },
    { href: BASE + '/new', label: '新しく作る', icon: Plus, hot: true },
    { href: BASE + '/company', label: '会社情報', icon: Building2 },
    { href: BASE + '/pricing', label: '料金プラン', icon: CreditCard },
  ]

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
    // インタビュー詳細も「インタビュー一覧」の中として扱う
    if (href === BASE) return pathname === BASE || pathname.startsWith(BASE + '/interviews')
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
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={shanaiTheme}>
        <SidebarLogoSection icon={BookUser} title="ドヤ社内インタビュー" showLabel={showLabel} />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ社内インタビュー" isCollapsed={isCollapsed} theme={shanaiTheme} />
            {NAV.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive(item.href)}
                showLabel={showLabel}
                theme={shanaiTheme}
                layoutId="shanaiActiveIndicator"
              />
            ))}
          </nav>

          {/* 作った数と残り。数字は /api/usage/shanai から受け取るだけ */}
          <SidebarUsagePanel service="shanai" show={sessionReady && (isMobile || !isCollapsed)} refreshEvent="shanai:generated" />

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
                プロプラン ¥9,980/月で{getServiceById('shanai')?.pricing.pro.limit}<TrialInlineSuffix />
              </p>
              <Link
                href="/shanai/pricing"
                className="block w-full py-2 bg-white text-slate-800 text-[11px] font-black rounded-lg text-center shadow-md transition-colors hover:bg-slate-50"
              >
                プロにアップグレード
              </Link>
            </div>
          )}
        </div>

        <ToolSwitcherMenu currentService="shanai" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={shanaiTheme}
          loginCallbackUrl="/shanai"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={shanaiTheme} />
        <SidebarBrandingFooter brandName="ドヤ社内インタビュー" isCollapsed={isCollapsed} theme={shanaiTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={shanaiTheme}
      />
    </>
  )
}

export default memo(ShanaiSidebarImpl)
