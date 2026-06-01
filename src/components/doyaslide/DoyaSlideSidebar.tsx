'use client'

import React, { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, Tag, Presentation } from 'lucide-react'
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
        {/* ロゴ */}
        <div className="px-3 sm:px-4 py-4 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md flex-shrink-0">
            <Presentation className="w-5 h-5 text-white" />
          </div>
          {showLabel && (
            <div className="leading-tight">
              <div className="font-black text-white text-base">ドヤスライド</div>
              <div className="text-[10px] text-fuchsia-200/70 font-bold">全スライドAI画像生成</div>
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
