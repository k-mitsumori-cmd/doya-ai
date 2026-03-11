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
  LogIn,
} from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
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
        <div className="flex-1 overflow-y-auto scrollbar-none">
        <nav className="px-3 space-y-0.5">
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
          <div className="mx-3 mt-4 mb-2">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-2">
              {!isLoggedIn ? (
                <>
                  <div className="flex items-center gap-2 text-[11px] text-violet-100 font-bold">
                    <LogIn className="w-3.5 h-3.5 text-violet-300" />
                    <span>ログインして音声を生成</span>
                  </div>
                  <button
                    onClick={() => signIn('google', { callbackUrl: '/voice' })}
                    className="w-full text-center text-[10px] font-black text-white transition-colors py-1.5 rounded-lg bg-violet-500/50 hover:bg-violet-500/70"
                  >
                    Googleでログイン
                  </button>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-400">今月の生成回数</p>
                    <p className="text-xs font-black text-white">{limitCount > 0 ? `${Math.round(pct)}%` : '--'}</p>
                  </div>
                  {limitCount !== -1 && (
                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${remaining === 0 ? 'bg-red-400' : isNearLimit ? 'bg-amber-400' : 'bg-gradient-to-r from-violet-500 to-purple-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] font-medium text-slate-400 text-center">
                    {usedCount} / {limitCount === -1 ? '∞' : `${limitCount}回`} (残り {remaining === -1 ? '無制限' : `${remaining}回`})
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* プランバナー */}
        {showLabel && currentPlan !== 'PRO' && currentPlan !== 'ENTERPRISE' && (
          <div className="mx-3 mt-4 my-2 p-4 rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-700/20 border border-violet-500/30 flex flex-col gap-3 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
              <Zap className="w-16 h-16 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              <div>
                <p className="text-xs font-black text-white">プラン案内</p>
                <p className="text-[10px] text-violet-300">{isLoggedIn ? `${planLabel}プラン利用中` : 'ゲスト'}</p>
              </div>
            </div>
            {isLoggedIn ? (
              <Link
                href="/voice/pricing"
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black rounded-lg transition-all shadow-md text-center"
              >
                PROにアップグレード
              </Link>
            ) : (
              <button
                onClick={() => signIn('google', { callbackUrl: '/voice' })}
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-black rounded-lg transition-all shadow-md text-center"
              >
                Googleでログイン
              </button>
            )}
          </div>
        )}

        </div>
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
