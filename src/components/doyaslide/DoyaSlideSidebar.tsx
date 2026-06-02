'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, Tag, Presentation, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { doyaslideTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
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

const MAIN_NAV: NavItem[] = [
  { href: '/doyaslide/new', label: '新規作成', icon: Plus, hot: true },
  { href: '/doyaslide', label: 'プロジェクト', icon: LayoutDashboard },
]

const SUB_NAV: NavItem[] = [
  { href: '/doyaslide/pricing', label: '料金プラン', icon: Tag },
]

interface DoyaSlideSidebarProps extends SidebarProps {
  plan?: string
}

function DoyaSlideSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
  plan,
}: DoyaSlideSidebarProps) {
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
    if (!plan && !isLoggedIn) return 'GUEST'
    const p = String(plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BUSINESS' || p === 'STARTER' || p === 'LIGHT' || p === 'BASIC') return 'PRO'
    return 'FREE'
  })()

  const isActive = (href: string) => {
    if (href === '/doyaslide') {
      // プロジェクト一覧 + エディタ(/doyaslide/{id})。new / pricing では光らせない
      if (pathname === '/doyaslide') return true
      return (
        (pathname?.startsWith('/doyaslide/') ?? false) &&
        !(pathname?.startsWith('/doyaslide/new') ?? false) &&
        !(pathname?.startsWith('/doyaslide/pricing') ?? false)
      )
    }
    return pathname?.startsWith(href) ?? false
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/doyaslide?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={doyaslideTheme}>
        {/* ロゴ: 展開時は公式ロゴ画像、折りたたみ時はアイコン（横長ロゴは32px枠で潰れるため出し分け） */}
        <div className="px-3 sm:px-4 py-4 flex items-center">
          {showLabel ? (
            <Link href="/doyaslide" className="block" aria-label="ドヤスライド">
              <img
                src="/doyaslide/logo.png"
                alt="ドヤスライド"
                className="h-11 w-auto object-contain drop-shadow-sm"
              />
            </Link>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md flex-shrink-0">
              <Presentation className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <div className="space-y-1">
              {MAIN_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  showLabel={showLabel}
                  theme={doyaslideTheme}
                  layoutId="doyaslideActiveIndicator"
                />
              ))}
            </div>

            <div className="pt-4 mt-3 border-t border-white/10 space-y-1">
              <SidebarSectionTitle title="その他" isCollapsed={isCollapsed} theme={doyaslideTheme} />
              {SUB_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  showLabel={showLabel}
                  theme={doyaslideTheme}
                  layoutId="doyaslideActiveIndicator"
                />
              ))}
            </div>
          </nav>

          {/* プラン案内（プロ未満のみ・アクティブ各サービスと統一） */}
          {(isMobile || !isCollapsed) && planLabel !== 'PRO' && planLabel !== 'ENTERPRISE' && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
              <div className="hidden md:block relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
                  </div>
                  <p className="text-xs font-black text-white">プラン案内</p>
                </div>
                <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
                  現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}
                </p>
                <p className="text-[10px] text-blue-100 font-bold leading-relaxed opacity-80">プロプラン：¥9,980/月</p>
                <Link
                  href="/doyaslide/pricing"
                  className="mt-3 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md block text-center"
                >
                  プロにアップグレード
                </Link>
              </div>
              <Link href="/doyaslide/pricing" className="md:hidden relative z-10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white font-bold leading-snug truncate">
                    {planLabel === 'GUEST' ? 'ゲスト' : planLabel} → プロ
                  </p>
                </div>
                <span className="flex-shrink-0 px-3 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-lg shadow-md whitespace-nowrap">
                  UP
                </span>
              </Link>
            </div>
          )}
        </div>

        <ToolSwitcherMenu
          currentService="doyaslide"
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
          theme={doyaslideTheme}
          settingsHref="/doyaslide"
          loginCallbackUrl="/doyaslide"
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
          theme={doyaslideTheme}
        />
        <SidebarBrandingFooter brandName="ドヤスライド" isCollapsed={isCollapsed} theme={doyaslideTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={doyaslideTheme}
      />
    </>
  )
}

export default memo(DoyaSlideSidebarImpl)
