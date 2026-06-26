'use client'

// ドヤAIO サイドバー（共通サイドバー部品で組成。アカウント表示/ログアウト/ツール切替を他サービスと統一）
import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, Zap, Eye, ScanSearch } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { aioTheme } from '@/components/sidebar/themes'
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

interface Props extends SidebarProps {
  orgSlug: string
  orgName?: string
}

function AioSidebarImpl({ orgSlug, orgName, isCollapsed: controlledIsCollapsed, onToggle, forceExpanded, isMobile }: Props) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const base = `/aio/${encodeURIComponent(orgSlug)}`
  // URL一本フローに合わせ、ブランド設定/監視プロンプトはナビから外す（自動セットアップ。ページ自体は残置）
  const NAV: NavItem[] = [
    { href: `${base}/scan`, label: 'URL AI調査', icon: ScanSearch, hot: true },
    { href: base, label: 'ダッシュボード', icon: LayoutDashboard },
    { href: '/aio/pricing', label: '料金プラン', icon: CreditCard },
  ]

  const planLabel = (() => {
    if (!isLoggedIn) return 'GUEST'
    const p = String((session?.user as any)?.plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return 'PRO'
    if (p === 'LIGHT') return 'LIGHT'
    return 'FREE'
  })()

  const isActive = (href: string) => {
    if (href === base) return pathname === base
    return pathname === href || pathname.startsWith(href + '/')
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/aio?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={aioTheme}>
        <SidebarLogoSection icon={Eye} title="ドヤAIO" subtitle={orgName || orgSlug} showLabel={showLabel} logoSrc="/aio/logo.png" />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤAIO" isCollapsed={isCollapsed} theme={aioTheme} />
            {NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={aioTheme} layoutId="aioActiveIndicator" />
            ))}
          </nav>

          {/* プランバナー */}
          {(isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Zap className="w-4 h-4 text-fuchsia-600 fill-fuchsia-600" />
                  </div>
                  <p className="text-xs font-black text-white">現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}</p>
                </div>
                <p className="text-[10px] text-purple-100 font-bold leading-relaxed opacity-90 mb-2">プロプラン ¥9,980/月・初月無料でSoV・引用元・改善アクションも閲覧</p>
                <Link href="/aio/pricing" className="w-full py-2 bg-white text-fuchsia-700 text-[11px] font-black rounded-lg hover:bg-purple-50 transition-colors shadow-md block text-center">
                  プロにアップグレード
                </Link>
              </div>
            </div>
          )}
        </div>

        <ToolSwitcherMenu currentService="aio" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={aioTheme}
          loginCallbackUrl="/aio"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={aioTheme} />
        <SidebarBrandingFooter brandName="ドヤAIO" isCollapsed={isCollapsed} theme={aioTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={aioTheme}
      />
    </>
  )
}

export default memo(AioSidebarImpl)
