'use client'

import React, { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  Plus,
  HelpCircle,
  Settings,
  CreditCard,
  LogOut,
  LogIn,
  User,
  Zap,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Image,
  FileText,
  LayoutGrid,
  ExternalLink,
  History,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { SUPPORT_CONTACT_URL, isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'
import { markLogoutToastPending } from '@/components/LogoutToastListener'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

const PERSONA_NAV: NavItem[] = [
  { href: '/persona', label: '新規ペルソナ生成', icon: Plus },
  { href: '/persona/history', label: '生成履歴', icon: History },
  { href: '/banner/pricing', label: '料金/プラン', icon: CreditCard },
]

interface PersonaSidebarProps {
  isMobile?: boolean
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
}

function PersonaSidebarImpl({
  isMobile,
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
}: PersonaSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)

  // プラン判定（バナーAIと共通）
  const planLabel = useMemo(() => {
    const bannerPlan = String((session?.user as any)?.bannerPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = bannerPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const nextPlanLabel = useMemo(() => {
    if (planLabel === 'GUEST' || planLabel === 'FREE') return 'PRO'
    if (planLabel === 'PRO') return 'ENTERPRISE'
    return 'CONSULT'
  }, [planLabel])

  // 1時間生成し放題判定
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

  const postLogoutUrl = '/persona?loggedOut=1'

  const requestLogout = () => {
    if (!isLoggedIn || isLoggingOut) return
    setIsLogoutDialogOpen(true)
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      markLogoutToastPending()
      await signOut({ callbackUrl: postLogoutUrl })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/persona') return pathname === '/persona'
    return pathname.startsWith(href)
  }

  const showLabel = isMobile || !isCollapsed

  // 1時間生成し放題バナー
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

  // プラン案内バナー
  const PlanBanner = () => {
    if (isFreeHourActive && freeHourRemainingMs > 0) return null
    if (!showLabel) return null

    const planHref = isLoggedIn ? '/banner/dashboard/plan' : '/banner/pricing'

    return (
      <div className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <Zap className="w-4 h-4 text-purple-600 fill-purple-600" />
            </div>
            <p className="text-xs font-black text-white">プラン案内</p>
          </div>
          <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
            現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel === 'FREE' ? '無料' : planLabel}
          </p>
          <p className="text-[10px] text-purple-100 font-bold leading-relaxed opacity-80">
            {nextPlanLabel === 'PRO' && <>PRO: 月額¥9,980で1日50回まで</>}
            {nextPlanLabel === 'ENTERPRISE' && <>Enterprise: 月額¥49,800で1日500回</>}
            {nextPlanLabel === 'CONSULT' && <>さらに上限UP：要相談</>}
          </p>
          <Link
            href={planHref}
            className="mt-2 w-full py-2 bg-white text-purple-600 text-[11px] font-black rounded-lg hover:bg-purple-50 transition-colors shadow-md block text-center"
          >
            {nextPlanLabel === 'CONSULT' ? '相談する' : nextPlanLabel === 'PRO' ? 'PROを始める' : 'Enterpriseへ'}
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
        className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-gradient-to-b from-purple-600 to-indigo-700 flex flex-col z-50 shadow-xl`}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
            <Target className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {showLabel && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="text-lg font-black text-white tracking-tighter leading-none">ドヤペルソナ</h1>
                <p className="text-[10px] font-bold text-purple-100/70 mt-0.5">ペルソナ＆クリエイティブ生成</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {PERSONA_NAV.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-purple-100/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-purple-200/70 group-hover:text-white'}`} />
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
                  {active && (
                    <motion.div
                      layoutId="personaActiveIndicator"
                      className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* 1時間生成し放題バナー */}
        <FreeHourBanner />

        {/* プラン案内バナー */}
        <PlanBanner />

        {/* 他のAIツールも使う */}
        <div className="px-3 pb-2">
          <div className="relative">
            <button
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/20 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 transition-all text-white ${
                !isMobile && isCollapsed ? 'justify-center' : 'justify-between'
              }`}
              title="他のツールを使う"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-white flex-shrink-0" />
                <AnimatePresence>
                  {showLabel && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      className="text-xs font-bold"
                    >
                      他のツールを使う
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {showLabel && (
                <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* ドロップダウンメニュー */}
            <AnimatePresence>
              {isToolsMenuOpen && showLabel && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                >
                  <div className="p-2 space-y-1">
                    <p className="px-2 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider">ツール一覧</p>
                    <a
                      href="/banner/dashboard"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-purple-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Image className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-purple-600 transition-colors">ドヤバナーAI</p>
                        <p className="text-[10px] font-bold text-gray-500">広告バナー生成</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-400" />
                    </a>
                    <a
                      href="/seo"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-purple-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-purple-600 transition-colors">ドヤライティングAI</p>
                        <p className="text-[10px] font-bold text-gray-500">SEO記事生成</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-purple-400" />
                    </a>
                    <a
                      href="/persona"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-purple-50 border border-purple-100"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Target className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-purple-600">ドヤペルソナ</p>
                        <p className="text-[10px] font-bold text-purple-500">ペルソナ生成（現在使用中）</p>
                      </div>
                    </a>
                  </div>
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 text-center">
                      すべて同じアカウントで利用可能
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* お問い合わせ */}
        <div className="px-3 pb-2">
          <a
            href={SUPPORT_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
              !isMobile && isCollapsed ? 'justify-center' : ''
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
                  className="min-w-0"
                >
                  <div className="text-xs font-bold leading-none">お問い合わせ</div>
                </motion.div>
              )}
            </AnimatePresence>
          </a>
        </div>

        {/* User Profile */}
        <div className="p-3 border-t border-white/5 bg-purple-800/30">
          <div className={`flex items-center gap-2 ${!isMobile && isCollapsed ? 'justify-center' : ''}`}>
            <Link
              href="/banner/dashboard/settings"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
              title="設定"
            >
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              <AnimatePresence>
                {showLabel && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-xs font-bold text-white truncate">
                      {session?.user?.name || (isLoggedIn ? 'ユーザー' : 'ゲスト')}
                    </p>
                    <p className="text-[10px] font-bold text-purple-100/60 truncate">
                      {planLabel === 'GUEST' ? 'ゲスト' : planLabel === 'FREE' ? '無料プラン' : `${planLabel}プラン`}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
            {showLabel && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {isLoggedIn ? (
                  <button
                    onClick={requestLogout}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="ログアウト"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/persona')}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-purple-600 text-[10px] font-black hover:bg-purple-50 transition-colors shadow-sm"
                    title="ログイン"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    ログイン
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        {!isMobile && (
          <button
            onClick={toggle}
            className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-colors border border-gray-100 z-10"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Branding */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 text-center border-t border-white/5"
            >
              <p className="text-[10px] text-purple-100/30 font-bold tracking-widest">ドヤペルソナ</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* ログアウト確認ダイアログ */}
      <AnimatePresence>
        {isLogoutDialogOpen && (
          <motion.div
            key="logout-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center p-4"
            onClick={() => (isLoggingOut ? null : setIsLogoutDialogOpen(false))}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-sm font-black text-slate-900">確認</p>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0">
                    AI
                  </div>
                  <div className="bg-slate-100 rounded-2xl px-3 py-2">
                    <p className="text-sm font-black text-slate-800 leading-relaxed">ログアウトしますか？</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                      いつでも再ログインできます。
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 flex gap-2">
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => setIsLogoutDialogOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => void confirmLogout()}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-black transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  ログアウト
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export const PersonaSidebar = memo(PersonaSidebarImpl)

