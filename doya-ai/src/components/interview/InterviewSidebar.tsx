'use client'

import React, { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  BookOpen,
  HelpCircle,
  LogOut,
  LogIn,
  User,
  Zap,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Settings,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { SUPPORT_CONTACT_URL, isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'
import { markLogoutToastPending } from '@/components/LogoutToastListener'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

const INTERVIEW_NAV: NavItem[] = [
  { href: '/interview', label: '記事作成', icon: Mic },
  { href: '/interview/projects', label: '記事一覧', icon: FolderOpen },
  { href: '/interview/skills', label: 'スキル', icon: BookOpen },
  { href: '/interview/settings', label: '設定', icon: Settings },
]

// 利用分数表示コンポーネント
function UsageStats({ showLabel, isLoggedIn, planLabel, isCollapsed }: { showLabel: boolean; isLoggedIn: boolean; planLabel: string; isCollapsed: boolean }) {
  const [usedMinutes, setUsedMinutes] = useState(0)
  const [limitMinutes, setLimitMinutes] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch('/api/interview/usage')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUsedMinutes(data.usedMinutes || 0)
          setLimitMinutes(data.limitMinutes || 0)
          setLoaded(true)
        }
      })
      .catch(() => {})
  }, [isLoggedIn])

  const pct = limitMinutes > 0 ? Math.min((usedMinutes / limitMinutes) * 100, 100) : 0
  const isNearLimit = pct >= 80
  const remainingMinutes = limitMinutes > 0 ? Math.max(limitMinutes - usedMinutes, 0) : -1

  // 折りたたみ時: コンパクトアイコン
  if (isCollapsed && !showLabel) {
    if (!isLoggedIn) return null
    return (
      <div className="flex justify-center mb-2" title={loaded ? `残り ${remainingMinutes === -1 ? '無制限' : `${remainingMinutes}分`}` : '文字起こし利用状況'}>
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${
          loaded && remainingMinutes === 0 ? 'bg-red-500/20' : isNearLimit ? 'bg-amber-500/20' : 'bg-white/10'
        }`}>
          <span className={`material-symbols-outlined text-lg ${
            loaded && remainingMinutes === 0 ? 'text-red-300' : isNearLimit ? 'text-amber-300' : 'text-white/70'
          }`}>timer</span>
          {loaded && remainingMinutes !== -1 && (
            <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center px-1 ${
              remainingMinutes === 0 ? 'bg-red-500 text-white' : isNearLimit ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-white'
            }`}>
              {remainingMinutes}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ゲスト向け: 制限情報のみ
  if (!isLoggedIn && showLabel) {
    return (
      <div className="mx-3 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">文字起こし</p>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-white/70 font-bold">
            <span className="material-symbols-outlined text-sm text-white/50">timer</span>
            <span>ゲスト: <span className="text-white font-black">5分</span> まで</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-amber-300/80 font-bold">
            <span className="material-symbols-outlined text-[10px]">star</span>
            <span>無料登録で30分/月に拡大</span>
          </div>
        </div>
      </div>
    )
  }

  if (!showLabel || !isLoggedIn) return null

  return (
    <AnimatePresence>
      {showLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mx-3 mb-2"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">文字起こし利用状況</p>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
            {/* 残り分数を目立つ表示 */}
            {loaded && (
              <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${
                remainingMinutes === 0 ? 'bg-red-500/20' : isNearLimit ? 'bg-amber-500/15' : 'bg-white/5'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-lg ${
                    remainingMinutes === 0 ? 'text-red-300' : isNearLimit ? 'text-amber-300' : 'text-[#a855f7]'
                  }`}>timer</span>
                  <span className="text-[11px] text-white/70 font-bold">残り</span>
                </div>
                <span className={`text-lg font-black tabular-nums ${
                  remainingMinutes === 0 ? 'text-red-300' : isNearLimit ? 'text-amber-300' : 'text-white'
                }`}>
                  {remainingMinutes === -1 ? '∞' : `${remainingMinutes}`}
                  <span className="text-[11px] text-white/50 font-bold ml-0.5">分</span>
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-white/60 font-bold">今月の使用量</span>
                {loaded ? (
                  <span className={`font-black tabular-nums text-[10px] ${isNearLimit ? 'text-amber-300' : 'text-white/70'}`}>
                    {usedMinutes} / {limitMinutes === -1 ? '∞' : `${limitMinutes}分`}
                  </span>
                ) : (
                  <span className="text-white/50 text-[10px]">--</span>
                )}
              </div>
              {limitMinutes > 0 && (
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      remainingMinutes === 0 ? 'bg-red-400' : isNearLimit ? 'bg-amber-400' : 'bg-[#a855f7]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
            {loaded && remainingMinutes === 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-red-300 font-bold">
                <span className="material-symbols-outlined text-xs">warning</span>
                <span>上限に達しました。プランをアップグレードしてください。</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-bold">
              <span className="material-symbols-outlined text-[10px]">schedule</span>
              <span>毎月リセット</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface InterviewSidebarProps {
  isMobile?: boolean
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
}

function InterviewSidebarImpl({
  isMobile,
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
}: InterviewSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // プラン判定
  const planLabel = useMemo(() => {
    const interviewPlan = String((session?.user as any)?.interviewPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = interviewPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
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
      setFreeHourRemainingMs(getFreeHourRemainingMs(firstLoginAt))
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

  const postLogoutUrl = '/interview/projects?loggedOut=1'

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

  // Stripe Checkout へ遷移
  const handleUpgrade = async (planId: string) => {
    if (!isLoggedIn) {
      router.push(`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/interview/projects')}`)
      return
    }
    setIsUpgrading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingPeriod: 'monthly' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e) {
      console.error('Checkout error:', e)
    } finally {
      setIsUpgrading(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/interview') {
      return pathname === '/interview'
    }
    if (href === '/interview/projects') {
      return pathname === '/interview/projects' || pathname?.startsWith('/interview/projects/')
    }
    return pathname?.startsWith(href)
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

  // ゲスト向け「無料登録」バナー（コンパクト）
  const GuestPromo = () => {
    if (isLoggedIn || !showLabel) return null

    return (
      <div className="mx-3 mb-2">
        <Link
          href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/interview')}`}
          className="block p-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 relative overflow-hidden shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white drop-shadow-sm">無料登録で1時間使い放題</p>
              <p className="text-[10px] text-white/80 font-bold">Googleアカウントで10秒</p>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  // プランアップグレードバナー（ログインユーザー向け・コンパクト）
  const PlanBanner = () => {
    if (isFreeHourActive && freeHourRemainingMs > 0) return null
    if (!showLabel || !isLoggedIn) return null
    if (planLabel === 'ENTERPRISE') return null

    return (
      <div className="mx-3 mb-2">
        {nextPlanLabel === 'CONSULT' ? (
          <a
            href={SUPPORT_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white">上限UP相談</p>
            </div>
          </a>
        ) : (
          <button
            onClick={() => handleUpgrade(nextPlanLabel === 'PRO' ? 'interview-pro' : 'interview-enterprise')}
            disabled={isUpgrading}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-60"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              {isUpgrading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Zap className="w-3.5 h-3.5 text-white" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[11px] font-black text-white">{nextPlanLabel}にアップグレード</p>
              <p className="text-[9px] text-white/50 font-bold">
                {nextPlanLabel === 'PRO' ? '月額¥9,980' : '月額¥49,980'}
              </p>
            </div>
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-gradient-to-b from-[#7f19e6] via-[#6b12c9] to-[#4a0e8f] flex flex-col z-50 shadow-xl`}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {showLabel && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="text-lg font-black text-white tracking-tighter leading-none">ドヤインタビューAI</h1>
                <p className="text-[10px] font-bold text-purple-100/70 mt-0.5">AI記事生成</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {INTERVIEW_NAV.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-purple-100/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-purple-200/75 group-hover:text-white'}`}
                  />
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
                      layoutId="interviewActiveIndicator"
                      className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
                    />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Usage Stats */}
        <UsageStats showLabel={showLabel} isLoggedIn={isLoggedIn} planLabel={planLabel} isCollapsed={isCollapsed} />

        {/* 1時間生成し放題バナー（アクティブ時のみ表示） */}
        <FreeHourBanner />

        {/* ゲスト向け登録プロモ */}
        <GuestPromo />

        {/* プランアップグレード */}
        <PlanBanner />

        {/* 他のAIツール */}
        <ToolSwitcherMenu currentTool="interview" showLabel={showLabel} isCollapsed={isCollapsed} className="px-3 pb-2" />

        {/* User Profile */}
        <div className="p-3 border-t border-white/5 bg-[#4a0e8f]/40">
          <div className={`flex items-center gap-2 ${!isMobile && isCollapsed ? 'justify-center' : ''}`}>
            <Link
              href="/interview/settings"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
              title="設定"
            >
              <div className="w-8 h-8 rounded-full bg-[#7f19e6] flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
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
                    href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/interview/projects')}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-[#7f19e6] text-[10px] font-black hover:bg-purple-50 transition-colors shadow-sm"
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
            className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-[#7f19e6] hover:bg-purple-50 transition-colors border border-gray-100 z-10"
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
              <p className="text-[10px] text-purple-100/35 font-bold tracking-widest">ドヤインタビューAI</p>
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

export default memo(InterviewSidebarImpl)
