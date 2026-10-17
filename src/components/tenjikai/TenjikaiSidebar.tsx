'use client'

import React, { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, FolderOpen, Gift, LayoutDashboard, Truck, Palette, PlusCircle, Wallet, Zap } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { tenjikaiTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarLogoSection,
  SidebarSectionTitle,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarHelpContact,
  SidebarUserProfile,
  SidebarLogoutDialog,
  useSidebarState,
} from '@/components/sidebar'
import type { SidebarProps } from '@/components/sidebar'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

export type Section = 'new' | 'overview' | 'booth' | 'creatives' | 'novelty' | 'budget' | 'vendors' | 'docs'

const NAV: { id: Section; label: string; icon: React.ElementType; hot?: boolean }[] = [
  { id: 'new', label: '新規出展プロジェクト', icon: PlusCircle, hot: true },
  { id: 'overview', label: '概要ダッシュボード', icon: LayoutDashboard },
  { id: 'booth', label: 'ブース設計', icon: Box },
  { id: 'creatives', label: '制作物スタジオ', icon: Palette },
  { id: 'novelty', label: 'ノベルティ', icon: Gift },
  { id: 'budget', label: '予算シミュレーター', icon: Wallet },
  { id: 'vendors', label: '業者選定・発注', icon: Truck },
  { id: 'docs', label: '資料庫・締切', icon: FolderOpen },
]

export function BoothMark({ className }: { className?: string }) {
  // ドヤ展示会のマーク：小間を等角投影で描いたもの
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <polygon points="16,6 28,12 16,18 4,12" fill="currentColor" opacity=".35" />
      <polygon points="4,12 16,6 16,2 4,8" fill="currentColor" />
      <polygon points="16,6 28,12 28,8 16,2" fill="currentColor" opacity=".7" />
      <polygon points="14,12 19,14.5 14,17 9,14.5" fill="#ffb020" />
    </svg>
  )
}

type Props = SidebarProps & {
  section: Section
  ready: boolean
  go: (s: Section) => void
  projectName?: string
}

// ドヤ展示会は1画面の中でセクションを切り替えるため、共通の SidebarNavLink（href 遷移）ではなく
// 同じ見た目のボタンで並べる。見た目を変えるときは SidebarNavLink と揃えること。
function SectionButton({
  item,
  isActive,
  disabled,
  showLabel,
  onClick,
}: {
  item: (typeof NAV)[number]
  isActive: boolean
  disabled: boolean
  showLabel: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={item.label} className="block w-full text-left disabled:cursor-not-allowed">
      <motion.div
        whileHover={disabled ? undefined : { x: 4 }}
        className={`relative flex items-center gap-3 px-3 py-3.5 sm:py-2.5 rounded-xl transition-all group ${
          isActive
            ? 'bg-white/15 text-white'
            : `${tenjikaiTheme.navText} ${disabled ? 'opacity-40' : 'hover:text-white hover:bg-white/10'}`
        }`}
      >
        <Icon className={`w-6 h-6 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? 'text-white' : `${tenjikaiTheme.navTextIcon} ${disabled ? '' : 'group-hover:text-white'}`}`} />
        <AnimatePresence>
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-base sm:text-sm font-bold sm:font-medium whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {item.hot && showLabel && !isActive && (
          <span className="ml-auto px-2 py-1 sm:px-1.5 sm:py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-xs sm:text-[10px] font-bold text-white rounded-md shadow-sm">
            NEW
          </span>
        )}
        {isActive && <motion.div layoutId="tenjikaiActiveIndicator" className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full" />}
      </motion.div>
    </button>
  )
}

function TenjikaiSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
  section,
  ready,
  go,
  projectName,
}: Props) {
  const { data: session } = useSession()
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/tenjikai?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={tenjikaiTheme}>
        <SidebarLogoSection icon={BoothMark} title="ドヤ展示会" subtitle="開発中" showLabel={showLabel} />

        {showLabel && projectName && (
          <div className="mx-3 mb-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2">
            <p className="text-[10px] font-bold text-white/60">出展プロジェクト</p>
            <p className="truncate text-xs font-bold text-white">{projectName}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="py-4 sm:py-6 px-3 space-y-1">
            <SidebarSectionTitle title="ドヤ展示会" isCollapsed={isCollapsed} theme={tenjikaiTheme} />
            {NAV.map((item) => (
              <SectionButton
                key={item.id}
                item={item}
                isActive={section === item.id}
                disabled={!ready && item.id !== 'new'}
                showLabel={showLabel}
                onClick={() => go(item.id)}
              />
            ))}
          </nav>

          {/* 料金は未確定（coming_soon）。確定したら SidebarUsagePanel とプラン案内に置き換える */}
          {(isMobile || !isCollapsed) && (
            <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4 text-[#6a12c4] fill-[#6a12c4]" />
                </div>
                <p className="text-xs font-black text-white">開発中のサービスです</p>
              </div>
              <p className="text-[11px] text-white/80 font-bold leading-relaxed">
                画面はお試し用です。入力した内容は保存されません。
              </p>
            </div>
          )}
        </div>
        <ToolSwitcherMenu currentService="tenjikai" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 sm:px-4 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={tenjikaiTheme}
          loginCallbackUrl="/tenjikai"
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={tenjikaiTheme} />
        <SidebarBrandingFooter brandName="ドヤ展示会" isCollapsed={isCollapsed} theme={tenjikaiTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={tenjikaiTheme}
      />
    </>
  )
}

export default memo(TenjikaiSidebarImpl)
