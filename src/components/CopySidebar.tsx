'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, PenLine, LayoutTemplate, Settings, BookOpen, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { copyTheme } from '@/components/sidebar/themes'
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

const COPY_NAV: NavItem[] = [
  { href: '/copy/new', label: '新規コピー生成', icon: PenLine, hot: true },
  { href: '/copy', label: 'ダッシュボード', icon: LayoutTemplate },
  { href: '/copy/history', label: '生成履歴', icon: Clock },
  { href: '/copy/templates', label: 'ライタープリセット', icon: BookOpen },
  { href: '/copy/settings', label: 'ブランド設定', icon: Settings },
]

function CopySidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const userPlan = (session?.user as any)?.plan || 'FREE'
  const planLabel = isLoggedIn ? userPlan : 'GUEST'

  const isActive = (href: string) => {
    if (href === '/copy') return pathname === '/copy'
    return pathname.startsWith(href)
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/copy?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={copyTheme}>
        <SidebarLogoSection icon={PenLine} title="ドヤコピーAI" showLabel={showLabel} />

        <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-3 space-y-1 custom-scrollbar">
          <div className="space-y-1">
            <SidebarSectionTitle title="ドヤコピーAI" isCollapsed={isCollapsed} theme={copyTheme} />
            {COPY_NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={copyTheme} layoutId="copyActiveIndicator" />
            ))}
          </div>
        </nav>

        {/* プランバナー */}
        {(isMobile || !isCollapsed) && (
          <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
            <div className="hidden md:block relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                </div>
                <p className="text-xs font-black text-white">プラン案内</p>
              </div>
              <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
                現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}
              </p>
              <p className="text-[10px] text-amber-100 font-bold leading-relaxed opacity-80">
                PROプラン：¥9,980/月
              </p>
              <Link
                href="/copy/pricing"
                className="mt-3 w-full py-2 bg-white text-amber-600 text-[11px] font-black rounded-lg hover:bg-amber-50 transition-colors shadow-md block text-center"
              >
                PROを始める
              </Link>
            </div>
            <Link
              href="/copy/pricing"
              className="md:hidden relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white font-bold leading-snug truncate">
                  {planLabel === 'GUEST' ? 'ゲスト' : planLabel} → PRO
                </p>
              </div>
              <span className="flex-shrink-0 px-3 py-1.5 bg-white text-amber-600 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-colors shadow-md whitespace-nowrap">
                UP
              </span>
            </Link>
          </div>
        )}

        <ToolSwitcherMenu currentService="copy" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={copyTheme}
          loginCallbackUrl="/copy"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={copyTheme} />
        <SidebarBrandingFooter brandName="ドヤコピーAI" isCollapsed={isCollapsed} theme={copyTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={copyTheme}
      />
    </>
  )
}

export default memo(CopySidebarImpl)
