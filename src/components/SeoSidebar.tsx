'use client'

import React, { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Sparkles,
  CreditCard,
  Zap,
  LayoutTemplate,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { TrialInlineSuffix } from '@/components/TrialCallout'
import { seoTheme } from '@/components/sidebar/themes'
import {
  SidebarShell,
  SidebarCollapseToggle,
  SidebarBrandingFooter,
  SidebarHelpContact,
  SidebarUserProfile,
  SidebarLogoutDialog,
  SidebarFreeHourBanner,
  SidebarLogoSection,
  useSidebarState,
  useFreeHour,
  SidebarUsagePanel,
} from '@/components/sidebar'
import { SEO_PRICING } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'
import { UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'
import type { SidebarProps } from '@/components/sidebar'

type SeoNavItem = {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
}

const SEO_NAV: SeoNavItem[] = [
  { href: '/seo/swipe', label: 'スワイプ記事作成', icon: Sparkles },
  { href: '/seo/template', label: 'テンプレ記事作成', icon: LayoutTemplate },
  { href: '/seo', label: '生成記事一覧', icon: FileText },
  { href: '/seo/pricing', label: '料金プラン設定', icon: CreditCard },
]

function SeoSidebarImpl({
  isMobile,
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session, status: sessionStatus } = useSession()
  // ⚠️ セッション確定前は plan が既定値になり、一瞬だけゲスト扱いの表示が出てしまう。
  //    表示を止め、使用状況の取得は共通パネルで認証状態を確認する。
  const sessionReady = sessionStatus !== 'loading'
  const { isCollapsed, showLabel, toggle } = useSidebarState({ controlledIsCollapsed, onToggle, forceExpanded, isMobile })
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // プラン判定
  const seoPlanLabel = useMemo(() => {
    return isLoggedIn ? higherPlan((session?.user as any)?.seoPlan, (session?.user as any)?.plan) : 'GUEST'
  }, [session, isLoggedIn])

  // 1時間生成し放題
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const { isFreeHourActive, freeHourRemainingMs } = useFreeHour(firstLoginAt)

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      markLogoutToastPending()
      await signOut({ callbackUrl: '/seo/articles?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/seo/create') return pathname === '/seo/create'
    if (href === '/seo') return pathname === '/seo'
    if (href === '/seo/articles') return pathname.startsWith('/seo/articles')
    return pathname.startsWith(href)
  }

  return (
    <>
      <SidebarShell isCollapsed={isCollapsed} isMobile={isMobile} theme={seoTheme}>
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {showLabel && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="text-lg font-black text-white tracking-tighter leading-none">ドヤライティングAI</h1>
                <p className="text-[10px] font-bold text-emerald-100/70 mt-0.5">SEOライティングAI</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation（SEO固有: hrefの動的書き換えがあるためNavLink共通化せず） */}
        <div className="flex-1 overflow-y-auto">
        <nav className="py-4 px-3 space-y-1">
          {SEO_NAV.map((item) => {
            const href = item.href === '/seo/pricing' ? (isLoggedIn ? '/seo/dashboard/plan' : '/seo/pricing') : item.href
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-emerald-100/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-emerald-200/75 group-hover:text-white'}`} />
                  <AnimatePresence>
                    {showLabel && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-semibold whitespace-nowrap overflow-hidden flex items-center gap-2"
                      >
                        {item.label}
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {active && (
                    <motion.div
                      layoutId="seoActiveIndicator"
                      className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* 1時間生成し放題バナー */}
        {isFreeHourActive && (
          <SidebarFreeHourBanner freeHourRemainingMs={freeHourRemainingMs} isCollapsed={isCollapsed} isMobile={isMobile} />
        )}

        {/* プラン案内バナー（使用状況は共通パネルに集約） */}
        {/* 作った数と残り。数字は /api/usage/seo から受け取るだけ */}
        <SidebarUsagePanel service="seo" show={sessionReady && (isMobile || !isCollapsed)} />
        {sessionReady && !(isFreeHourActive && freeHourRemainingMs > 0) && showLabel && (
          <div className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
                  <Zap className="w-4 h-4 text-emerald-700 fill-emerald-700" />
                </div>
                <p className="text-xs font-black text-white">プラン案内</p>
              </div>
              <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
                現在：{seoPlanLabel === 'GUEST' ? 'ゲスト' : seoPlanLabel === 'FREE' ? '無料' : seoPlanLabel}
              </p>
              <p className="text-[10px] text-emerald-100 font-bold leading-relaxed opacity-80">
                {seoPlanLabel === 'PRO' || seoPlanLabel === 'ENTERPRISE'
                  ? <>さらに上限UP：要相談</>
                  : <>プロ: 月額{UNIFIED_PRO_PRICE_LABEL}<TrialInlineSuffix />で月{SEO_PRICING.proLimit}回まで</>}
              </p>
              <Link
                href={isLoggedIn ? '/seo/dashboard/plan' : '/seo/pricing'}
                className="mt-2 w-full py-2 bg-white text-emerald-700 text-[11px] font-black rounded-lg hover:bg-emerald-50 transition-colors shadow-md block text-center"
              >
                {seoPlanLabel === 'PRO' || seoPlanLabel === 'ENTERPRISE' ? '相談する' : 'プロにアップグレード'}
              </Link>
            </div>
          </div>
        )}

        </div>
        <ToolSwitcherMenu currentService="seo" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 pb-2" />
        <SidebarHelpContact showLabel={showLabel} isCollapsed={isCollapsed} isMobile={isMobile} />
        <SidebarUserProfile
          session={session}
          isLoggedIn={isLoggedIn}
          showLabel={showLabel}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          theme={seoTheme}
          settingsHref="/seo/settings"
          loginCallbackUrl={pathname || '/seo'}
          onLogout={() => setIsLogoutDialogOpen(true)}
          renderExtra={() => (
            <p className="text-[10px] font-bold text-emerald-100/60 truncate">
              {seoPlanLabel === 'GUEST' ? 'ゲスト' : seoPlanLabel === 'FREE' ? '無料プラン' : `${seoPlanLabel}プラン`}
            </p>
          )}
        />
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={toggle} isMobile={isMobile} theme={seoTheme} />
        <SidebarBrandingFooter brandName="ドヤライティングAI" isCollapsed={isCollapsed} theme={seoTheme} />
      </SidebarShell>

      <SidebarLogoutDialog
        isOpen={isLogoutDialogOpen}
        isLoggingOut={isLoggingOut}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={() => void confirmLogout()}
        theme={seoTheme}
      />
    </>
  )
}

export const SeoSidebar = memo(SeoSidebarImpl)
