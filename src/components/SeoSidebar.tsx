'use client'

import React, { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Plus,
  Sparkles,
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
  LayoutTemplate,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { SUPPORT_CONTACT_URL, SEO_PRICING, isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
}

const SEO_NAV: NavItem[] = [
  { href: '/seo/swipe', label: '記事作成', icon: Sparkles },
  { href: '/seo/create', label: '新規記事作成', icon: Plus },
  { href: '/seo/test', label: 'テンプレ記事作成', icon: LayoutTemplate },
  { href: '/seo', label: '生成記事一覧', icon: FileText },
  { href: '/seo/pricing', label: '料金プラン設定', icon: CreditCard },
]

interface SeoSidebarProps {
  isMobile?: boolean
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
}

function SeoSidebarImpl({
  isMobile,
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
}: SeoSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // プラン判定
  const seoPlanLabel = useMemo(() => {
    const seoPlan = String((session?.user as any)?.seoPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = seoPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const nextPlanLabel = useMemo(() => {
    if (seoPlanLabel === 'GUEST' || seoPlanLabel === 'FREE') return 'PRO'
    if (seoPlanLabel === 'PRO') return 'ENTERPRISE'
    return 'CONSULT'
  }, [seoPlanLabel])

  // 残り記事数
  const [entitlements, setEntitlements] = useState<{ remaining?: { articles?: number }; limits?: { articlesPerMonth?: number } } | null>(null)
  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/seo/entitlements', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j?.success) setEntitlements(j) })
      .catch(() => {})
  }, [isLoggedIn])

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

  const postLogoutUrl = '/seo/articles?loggedOut=1'

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
    if (href === '/seo/create') return pathname === '/seo/create'
    if (href === '/seo') return pathname === '/seo'
    if (href === '/seo/articles') return pathname.startsWith('/seo/articles')
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

    const planHref = isLoggedIn ? '/seo/dashboard/plan' : '/seo/pricing'

    return (
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
          {/* 残り記事数 */}
          {entitlements && (() => {
            const remaining = entitlements.remaining?.articles
            const limit = entitlements.limits?.articlesPerMonth
            if (remaining === -1) return (
              <p className="text-[10px] text-emerald-200 font-black mb-1.5">生成し放題</p>
            )
            if (typeof remaining === 'number' && typeof limit === 'number' && limit > 0) {
              const used = limit - remaining
              const pct = Math.min((used / limit) * 100, 100)
              return (
                <div className="mb-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-emerald-100 font-black">
                      残り{remaining}/{limit}回
                    </span>
                    <span className="text-[9px] text-emerald-200/60 font-bold">/ 月</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${remaining <= 0 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-white'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            }
            return null
          })()}
          <p className="text-[10px] text-emerald-100 font-bold leading-relaxed opacity-80">
            {nextPlanLabel === 'PRO' && <>PRO: 月額¥9,980で20,000字まで</>}
            {nextPlanLabel === 'ENTERPRISE' && <>Enterprise: 月額¥49,980で50,000字まで</>}
            {nextPlanLabel === 'CONSULT' && <>さらに上限UP：要相談</>}
          </p>
          <Link
            href={planHref}
            className="mt-2 w-full py-2 bg-white text-emerald-700 text-[11px] font-black rounded-lg hover:bg-emerald-50 transition-colors shadow-md block text-center"
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
        className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-gradient-to-b from-emerald-600 via-green-600 to-teal-700 flex flex-col z-50 shadow-xl`}
      >
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {SEO_NAV.map((item) => {
            // 「料金/プラン」は、ログイン済みならプラン管理へ（迷いを無くす）
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
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-emerald-200/75 group-hover:text-white'}`}
                  />
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
        <FreeHourBanner />

        {/* プラン案内バナー */}
        <PlanBanner />

        {/* 他のAIツールも使う（共通） */}
        <ToolSwitcherMenu currentService="seo" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 pb-2" />

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
        <div className="p-3 border-t border-white/5 bg-emerald-900/25">
          <div className={`flex items-center gap-2 ${!isMobile && isCollapsed ? 'justify-center' : ''}`}>
            <Link
              href="/seo/settings"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
              title="設定"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
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
                    <p className="text-[10px] font-bold text-emerald-100/60 truncate">
                      {seoPlanLabel === 'GUEST' ? 'ゲスト' : seoPlanLabel === 'FREE' ? '無料プラン' : `${seoPlanLabel}プラン`}
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
                    href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/seo')}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-emerald-700 text-[10px] font-black hover:bg-emerald-50 transition-colors shadow-sm"
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
            className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-emerald-700 hover:bg-emerald-50 transition-colors border border-gray-100 z-10"
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
              <p className="text-[10px] text-emerald-100/35 font-bold tracking-widest">ドヤライティングAI</p>
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
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0">
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

export const SeoSidebar = memo(SeoSidebarImpl)
