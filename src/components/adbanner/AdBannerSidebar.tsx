'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Sparkles, CreditCard, Zap, Megaphone } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { adbannerTheme } from '@/components/sidebar/themes'
import {
  SidebarShell, SidebarLogoSection, SidebarNavLink, SidebarSectionTitle,
  SidebarCollapseToggle, SidebarBrandingFooter, SidebarHelpContact,
  SidebarUserProfile, SidebarLogoutDialog, useSidebarState,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

const NAV: NavItem[] = [
  { href: '/adbanner/dashboard', label: 'キャンペーン一覧', icon: LayoutDashboard },
  { href: '/adbanner/dashboard/new', label: '新規キャンペーン', icon: Sparkles, hot: true },
  { href: '/adbanner/pricing', label: '料金プラン', icon: CreditCard },
]

function AdBannerSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const planLabel = (() => {
    if (!isLoggedIn) return 'GUEST'
    const p = String((session?.user as any)?.plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (['PRO', 'BASIC', 'STARTER', 'BUSINESS', 'BUNDLE'].includes(p)) return 'PRO'
    return 'FREE'
  })()
  const isActive = (href: string) => {
    if (href === '/adbanner/dashboard') return pathname === '/adbanner/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }
  const confirmLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try { await signOut({ callbackUrl: '/adbanner?loggedOut=1' }) } finally { setLoggingOut(false); setLogoutOpen(false) }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={adbannerTheme}>
        <SidebarLogoSection icon={Megaphone} title="ドヤ広告バナーAI" showLabel={showLabel} />
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ広告バナーAI" isCollapsed={isCollapsed} theme={adbannerTheme} />
            {NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={adbannerTheme} layoutId="adbannerActiveIndicator" />
            ))}
          </nav>
          {(isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white grid place-items-center shadow-md"><Zap className="w-4 h-4 text-orange-500 fill-orange-500" /></div>
                <p className="text-xs font-black text-white">現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}</p>
              </div>
              <p className="text-[10px] text-purple-100 font-bold opacity-90 mb-2">PRO ¥9,980/月で 1日60枚・全サイズ・改善</p>
              <Link href="/adbanner/pricing" className="block w-full py-2 bg-white text-orange-600 text-[11px] font-black rounded-lg text-center hover:bg-orange-50 transition-colors shadow-md">プロにアップグレード</Link>
            </div>
          )}
        </div>
        <ToolSwitcherMenu currentService="adbanner" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile session={session} isLoggedIn={isLoggedIn} showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} theme={adbannerTheme} loginCallbackUrl="/adbanner/dashboard" onLogout={() => setLogoutOpen(true)} />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={adbannerTheme} />
        <SidebarBrandingFooter brandName="ドヤ広告バナーAI" isCollapsed={isCollapsed} theme={adbannerTheme} />
      </SidebarShell>
      <SidebarLogoutDialog isOpen={logoutOpen} isLoggingOut={loggingOut} onClose={() => setLogoutOpen(false)} onConfirm={() => void confirmLogout()} theme={adbannerTheme} />
    </>
  )
}
export default memo(AdBannerSidebarImpl)
