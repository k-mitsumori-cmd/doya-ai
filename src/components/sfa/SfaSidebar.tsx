'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Kanban, UserPlus, Tag, TrendingUp, Zap, ChevronsUpDown, Check } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { sfaTheme } from '@/components/sidebar/themes'
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

interface Membership { slug: string; name: string; role: string }
interface SfaSidebarProps extends SidebarProps {
  plan?: string
  orgSlug: string
  memberships?: Membership[]
}

function SfaSidebarImpl({ isCollapsed: c, onToggle, forceExpanded, isMobile, plan, orgSlug, memberships = [] }: SfaSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed: c, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [wsOpen, setWsOpen] = useState(false)
  const base = `/sfa/${orgSlug}`
  const currentWs = memberships.find((m) => m.slug === orgSlug)

  const MAIN_NAV: NavItem[] = [
    { href: base, label: 'ダッシュボード', icon: LayoutDashboard },
    { href: `${base}/deals`, label: '商談（パイプライン）', icon: Kanban, hot: true },
    { href: `${base}/accounts`, label: '取引先', icon: Building2 },
  ]
  const SUB_NAV: NavItem[] = [
    { href: `${base}/members`, label: 'メンバー', icon: UserPlus },
    { href: '/sfa/pricing', label: '料金プラン', icon: Tag },
  ]

  const planLabel = (() => {
    if (!plan && !isLoggedIn) return 'GUEST'
    const p = String(plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (['PRO', 'BUSINESS', 'STARTER', 'LIGHT', 'BASIC'].includes(p)) return 'PRO'
    return 'FREE'
  })()

  const isActive = (href: string) => (href === base ? pathname === base : (pathname?.startsWith(href) ?? false))

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/sfa?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={sfaTheme}>
        <div className="px-3 sm:px-4 py-4">
          {showLabel ? (
            <Link href={base} className="block rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
              <Image
                src="/sfa/logo.png"
                alt="ドヤ営業管理"
                width={2016}
                height={864}
                priority
                className="w-full h-auto"
              />
            </Link>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* ワークスペース切替 */}
        {showLabel && memberships.length > 0 && (
          <div className="px-3 sm:px-4 pb-3 relative">
            <button
              onClick={() => setWsOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-left"
            >
              <Building2 className="w-4 h-4 text-white/80 flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm font-black text-white">{currentWs?.name || 'ワークスペース'}</span>
              <ChevronsUpDown className="w-4 h-4 text-white/70 flex-shrink-0" />
            </button>
            {wsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setWsOpen(false)} />
                <div className="absolute left-3 right-3 sm:left-4 sm:right-4 mt-1 z-40 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 max-h-72 overflow-y-auto">
                  <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase">ワークスペース</p>
                  {memberships.map((m) => (
                    <Link
                      key={m.slug}
                      href={`/sfa/${m.slug}`}
                      onClick={() => setWsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center text-white text-[11px] font-black flex-shrink-0">
                        {m.name.slice(0, 1)}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm font-black text-slate-700">{m.name}</span>
                      {m.slug === orgSlug && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <div className="space-y-1">
              {MAIN_NAV.map((item) => (
                <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={sfaTheme} layoutId="sfaActiveIndicator" />
              ))}
            </div>
            <div className="pt-4 mt-3 border-t border-white/10 space-y-1">
              <SidebarSectionTitle title="その他" isCollapsed={isCollapsed} theme={sfaTheme} />
              {SUB_NAV.map((item) => (
                <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={sfaTheme} layoutId="sfaActiveIndicator" />
              ))}
            </div>
          </nav>

          {(isMobile || !isCollapsed) && planLabel !== 'PRO' && planLabel !== 'ENTERPRISE' && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
              <div className="hidden md:block relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Zap className="w-4 h-4 text-green-600 fill-green-600" />
                  </div>
                  <p className="text-xs font-black text-white">プラン案内</p>
                </div>
                <p className="text-[11px] text-white font-bold mb-1">現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}</p>
                <p className="text-[10px] text-lime-100 font-bold opacity-80">プロプラン：¥9,980/月</p>
                <Link href="/sfa/pricing" className="mt-3 w-full py-2 bg-white text-green-700 text-[11px] font-black rounded-lg hover:bg-green-50 transition-colors shadow-md block text-center">
                  プロにアップグレード
                </Link>
              </div>
            </div>
          )}
        </div>

        <ToolSwitcherMenu currentService="sfa" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={sfaTheme}
          settingsHref={`${base}/members`}
          loginCallbackUrl="/sfa"
          onLogout={() => setIsLogoutDialogOpen(true)}
          renderExtra={() => (
            <p className="text-[11px] font-bold text-white/60 truncate">{planLabel === 'GUEST' ? 'ゲスト' : `${planLabel} プラン`}</p>
          )}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={sfaTheme} />
        <SidebarBrandingFooter brandName="ドヤ営業管理" isCollapsed={isCollapsed} theme={sfaTheme} />
      </SidebarShell>

      <SidebarLogoutDialog isOpen={isLogoutDialogOpen} isLoggingOut={isLoggingOut} onClose={() => setIsLogoutDialogOpen(false)} onConfirm={() => void confirmLogout()} theme={sfaTheme} />
    </>
  )
}

export default memo(SfaSidebarImpl)
