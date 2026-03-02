'use client'

import React, { memo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Mic,
  Volume2,
  Users,
  History,
  Settings,
  BookOpen,
  CreditCard,
  Radio,
  Zap,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { VOICE_PRICING } from '@/lib/pricing'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { voiceTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarNavLink,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarHelpContact,
  SidebarUserProfile,
  SidebarLogoutDialog,
  useSidebarState,
} from '@/components/sidebar'
import type { NavItem, SidebarProps } from '@/components/sidebar'

const VOICE_NAV: NavItem[] = [
  { href: '/voice', label: 'ダッシュボード', icon: Volume2 },
  { href: '/voice/new', label: '新規生成', icon: Mic },
  { href: '/voice/speakers', label: 'ボイス一覧', icon: Users },
  { href: '/voice/record', label: '録音スタジオ', icon: Radio },
  { href: '/voice/history', label: '生成履歴', icon: History },
  { href: '/voice/guide', label: 'ガイド', icon: BookOpen },
  { href: '/voice/pricing', label: '料金プラン', icon: CreditCard },
  { href: '/voice/settings', label: '設定', icon: Settings },
]

function VoiceSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const user = session?.user as any
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [usedCount, setUsedCount] = useState(0)
  const [limitCount, setLimitCount] = useState(0)

  const planRaw = user?.voicePlan || user?.plan || 'FREE'
  const currentPlan = String(planRaw).toUpperCase()
  const planLabel = isLoggedIn ? currentPlan : 'GUEST'

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/voice/usage')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (data.success) {
          setUsedCount(data.used ?? 0)
          setLimitCount(data.limit ?? 0)
        }
      })
      .catch(() => {})
  }, [isLoggedIn])

  const isActive = (href: string) => {
    if (href === '/voice') return pathname === '/voice'
    return pathname?.startsWith(href) ?? false
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/voice?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const pct = limitCount > 0 ? Math.min((usedCount / limitCount) * 100, 100) : 0
  const isNearLimit = pct >= 80
  const remaining = limitCount > 0 ? Math.max(limitCount - usedCount, 0) : -1

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={voiceTheme}>
        <SidebarLogoSection icon={Mic} title="ドヤボイスAI" showLabel={showLabel} />

        {/* ツール切替 */}
        <div className="px-3 mb-3">
          <ToolSwitcherMenu
            currentService="voice"
            showLabel={showLabel}
            isCollapsed={isCollapsed}
            isMobile={isMobile}
          />
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-none">
          {VOICE_NAV.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              showLabel={showLabel}
              theme={voiceTheme}
              layoutId="voiceActiveIndicator"
            />
          ))}
        </nav>

        {/* 使用状況 */}
        {showLabel && (
          <div className="mx-3 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400/70 mb-2 px-1">今月の生成回数</p>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
              {!isLoggedIn ? (
                <>
                  <div className="flex items-center gap-2 text-[11px] text-violet-100 font-bold">
                    <Volume2 className="w-3.5 h-3.5 text-violet-300" />
                    <span>ゲスト: <span className="text-white font-black">{VOICE_PRICING.guestLimit}回</span> まで/月</span>
                  </div>
                  <Link
                    href="/voice/pricing"
                    className="block text-center text-[10px] font-bold text-violet-300 hover:text-white transition-colors py-1.5 rounded-lg bg-violet-700/30 hover:bg-violet-700/50"
                  >
                    プランを見る
                  </Link>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-violet-200">
                      {usedCount} / {limitCount === -1 ? '∞' : `${limitCount}回`}
                    </span>
                    <span className={`text-[10px] font-black ${remaining === 0 ? 'text-red-300' : isNearLimit ? 'text-amber-300' : 'text-violet-300'}`}>
                      残り {remaining === -1 ? '無制限' : `${remaining}回`}
                    </span>
                  </div>
                  {limitCount !== -1 && (
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${remaining === 0 ? 'bg-red-400' : isNearLimit ? 'bg-amber-400' : 'bg-violet-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* プランバナー */}
        {showLabel && currentPlan !== 'PRO' && currentPlan !== 'ENTERPRISE' && (
          <div className="mx-3 md:mx-4 my-2 p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-violet-600 fill-violet-600" />
              </div>
              <p className="text-xs font-black text-white">プラン案内</p>
            </div>
            <p className="text-[11px] text-white font-bold mb-1">現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}</p>
            <Link
              href="/voice/pricing"
              className="mt-2 w-full py-2 bg-white text-violet-600 text-[11px] font-black rounded-lg hover:bg-violet-50 transition-colors shadow-md block text-center"
            >
              PROを始める
            </Link>
          </div>
        )}

        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={voiceTheme}
          loginCallbackUrl="/voice"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={voiceTheme} />
        <SidebarBrandingFooter brandName="ドヤボイスAI" isCollapsed={isCollapsed} theme={voiceTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={voiceTheme}
      />
    </>
  )
}

export default memo(VoiceSidebarImpl)
