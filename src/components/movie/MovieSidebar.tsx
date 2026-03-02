'use client'
// ============================================
// ドヤムービーAI - サイドバー
// ============================================
import React, { memo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Film, PlusCircle, LayoutGrid, Clock, BookOpen, CreditCard, Zap } from 'lucide-react'
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
import { movieTheme } from '@/components/sidebar/themes'
import type { NavItem, SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { getMovieMonthlyLimitByUserPlan } from '@/lib/pricing'

const MOVIE_NAV: NavItem[] = [
  { href: '/movie', label: 'ダッシュボード', icon: Film },
  { href: '/movie/new/concept', label: '新規作成', icon: PlusCircle, hot: true },
  { href: '/movie/templates', label: 'テンプレート', icon: LayoutGrid },
  { href: '/movie/history', label: '生成履歴', icon: Clock },
  { href: '/movie/guide', label: '使い方ガイド', icon: BookOpen },
  { href: '/movie/pricing', label: '料金プラン', icon: CreditCard },
]

function MovieSidebarImpl({
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
  const [usedCount, setUsedCount] = useState(0)

  const user = session?.user as any
  const currentPlan = String(user?.moviePlan || user?.plan || 'FREE').toUpperCase()
  const planLabel = isLoggedIn ? currentPlan : 'GUEST'
  const limit = getMovieMonthlyLimitByUserPlan(currentPlan)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/movie/projects?limit=100')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const thisMonth = (data.projects || []).filter(
          (p: { createdAt: string }) => new Date(p.createdAt) >= monthStart
        )
        setUsedCount(thisMonth.length)
      })
      .catch(() => {})
  }, [isLoggedIn])

  const isActive = (href: string) => {
    if (href === '/movie') return pathname === '/movie'
    return pathname.startsWith(href)
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/movie?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const percent = limit > 0 ? Math.min((usedCount / limit) * 100, 100) : 0
  const isWarning = percent >= 80
  const isDanger = percent >= 100

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={movieTheme}>
        <SidebarLogoSection icon={Film} title="ドヤムービーAI" showLabel={showLabel} />

        <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-3 space-y-1 custom-scrollbar">
          <div className="space-y-1">
            <SidebarSectionTitle title="ドヤムービーAI" isCollapsed={isCollapsed} theme={movieTheme} />
            {MOVIE_NAV.map((item) => (
              <SidebarNavLink key={item.href} item={item} isActive={isActive(item.href)} showLabel={showLabel} theme={movieTheme} layoutId="movieActiveIndicator" />
            ))}
          </div>
        </nav>

        {/* 使用状況 */}
        {showLabel && isLoggedIn && (
          <div className="mx-3 mb-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="text-rose-200 text-xs font-semibold mb-2">今月の生成数</div>
            <div className="flex items-end gap-1 mb-2">
              <span className={`text-xl font-bold ${isDanger ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-white'}`}>
                {usedCount}
              </span>
              <span className="text-rose-300/60 text-sm mb-0.5">/ {limit} 本</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-rose-900/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isDanger ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-rose-400'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {/* プランバナー */}
        {showLabel && currentPlan !== 'PRO' && currentPlan !== 'ENTERPRISE' && (
          <div className="mx-3 mb-3">
            <Link
              href="/movie/pricing"
              className="block rounded-xl p-3 text-center transition-all"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)', boxShadow: '0 4px 12px rgba(244,63,94,0.3)' }}
            >
              <div className="text-white text-xs font-bold mb-0.5">Proにアップグレード</div>
              <div className="text-rose-100 text-xs">月30本・HD画質・全テンプレート</div>
              <div className="text-white font-bold text-sm mt-1">¥9,980/月</div>
            </Link>
          </div>
        )}

        <ToolSwitcherMenu currentService="movie" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={movieTheme}
          loginCallbackUrl="/movie"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={movieTheme} />
        <SidebarBrandingFooter brandName="ドヤムービーAI" isCollapsed={isCollapsed} theme={movieTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={movieTheme}
      />
    </>
  )
}

export default memo(MovieSidebarImpl)
