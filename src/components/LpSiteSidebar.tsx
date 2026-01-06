'use client'

import React, { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LogIn,
  User,
  Zap,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { SUPPORT_CONTACT_URL, isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  hot?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/lp-site', label: 'LP生成', icon: Sparkles, hot: true },
]

interface LpSiteSidebarProps {
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
  isMobile?: boolean
}

function LpSiteSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: LpSiteSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isLoggedIn = !!session?.user
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const planLabel = useMemo(() => {
    const lpPlan = String((session?.user as any)?.lpSitePlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = lpPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)

  useEffect(() => {
    if (!isFreeHourActive) return
    const interval = setInterval(() => {
      const remaining = getFreeHourRemainingMs(firstLoginAt)
      setFreeHourRemainingMs(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])

  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isCollapsed = forceExpanded ? false : (controlledIsCollapsed ?? internalIsCollapsed)
  const toggle = () => {
    const next = !isCollapsed
    if (onToggle) onToggle(next)
    else setInternalIsCollapsed(next)
  }

  const requestLogout = () => {
    if (!isLoggedIn || isLoggingOut) return
    markLogoutToastPending()
    signOut({ callbackUrl: '/lp-site?loggedOut=1' })
  }

  const isActive = (href: string) => {
    if (href === '/lp-site') return pathname === '/lp-site'
    return pathname.startsWith(href)
  }

  const showLabel = isMobile || !isCollapsed

  const FreeHourBanner = () => {
    if (!isFreeHourActive || freeHourRemainingMs <= 0) return null
    if (!showLabel) return null

    return (
      <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 border border-amber-300/50 relative overflow-hidden shadow-lg shadow-amber-500/20">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <span className="text-xl">🚀</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
            <p className="text-[10px] text-white/80 font-bold">全機能解放</p>
          </div>
          <div className="px-2.5 py-1.5 bg-white/30 rounded-lg backdrop-blur-sm flex-shrink-0">
            <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
              {formatRemainingTime(freeHourRemainingMs)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const PlanBanner = () => {
    if (isFreeHourActive && freeHourRemainingMs > 0) return null
    if (!showLabel) return null

    return (
      <div className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <Zap className="w-4 h-4 text-teal-600 fill-teal-600" />
            </div>
            <p className="text-xs font-black text-white">プラン案内</p>
          </div>
          <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
            現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}
          </p>
          <Link
            href="/lp-site/pricing"
            className="mt-2 w-full py-2 bg-white text-teal-600 text-[11px] font-black rounded-lg hover:bg-teal-50 transition-colors shadow-md block text-center"
          >
            PROを始める
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 72 : 240,
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-gradient-to-b from-teal-600 to-cyan-600 flex flex-col z-50 shadow-xl overflow-hidden`}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {showLabel && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden flex-1"
              >
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black text-white tracking-tighter leading-none">
                    ドヤサイト
                  </h1>
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md shadow-sm">
                    ベータ版
                  </span>
                </div>
                <p className="text-[10px] font-bold text-white/70 mt-0.5">
                  LP自動生成
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-3 pb-4">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                      
                      <AnimatePresence>
                        {showLabel && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="text-sm font-semibold whitespace-nowrap overflow-hidden"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {item.hot && showLabel && (
                        <span className="ml-auto px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-[10px] font-bold text-white rounded-md shadow-sm">
                          HOT
                        </span>
                      )}

                      {active && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
                        />
                      )}
                    </motion.div>
                  </Link>
                )
              })}
            </div>

            <FreeHourBanner />
            <PlanBanner />
          </div>

          {/* Fixed bottom section */}
          <div className="px-3 pb-2 mt-auto">
            <div className="relative">
              <ToolSwitcherMenu
                currentTool="lp-site"
                showLabel={showLabel}
                isCollapsed={isCollapsed}
                className="w-full"
              />
            </div>

            <div className="mt-2">
              <a
                href={SUPPORT_CONTACT_URL}
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                title="お問い合わせ"
              >
                <HelpCircle className="w-4 h-4 text-white flex-shrink-0" />
                <AnimatePresence>
                  {showLabel && (
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                    >
                      <div className="text-xs font-bold leading-none">お問い合わせ</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </a>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-3 border-t border-white/5 bg-teal-700/30">
          <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
            {isLoggedIn ? (
              <>
                <Link
                  href="/lp-site/settings"
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="User" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <AnimatePresence>
                    {showLabel && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {session?.user?.name || 'ゲスト'}
                        </p>
                        <p className="text-[10px] font-bold text-white/60 truncate">
                          {planLabel}プラン
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
                {showLabel && (
                  <button
                    onClick={requestLogout}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="ログアウト"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
              >
                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
                  <LogIn className="w-4 h-4 text-white" />
                </div>
                <AnimatePresence>
                  {showLabel && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p className="text-xs font-bold text-white">ログイン</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>
            )}
          </div>
        </div>

        {/* Collapse Button */}
        {!isMobile && (
          <button
            onClick={toggle}
            className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-teal-600 hover:bg-teal-50 transition-colors border border-gray-100 z-10"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </motion.aside>
    </>
  )
}

export const LpSiteSidebar = memo(LpSiteSidebarImpl)

