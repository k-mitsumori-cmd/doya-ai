'use client'

import React, { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Sparkles, 
  Clock, 
  Settings, 
  Palette,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  LogIn,
  User,
  Zap,
  Layers,
  CreditCard,
  Link2,
  Loader2
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, SUPPORT_CONTACT_URL, isWithinFreeHour, getFreeHourRemainingMs } from '@/lib/pricing'
import SidebarTour from '@/components/SidebarTour'
import { markLogoutToastPending } from '@/components/LogoutToastListener'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string | number
  hot?: boolean
}

const bannerNavItems: NavItem[] = [
  { href: '/banner', label: 'URL自動生成', icon: Link2, hot: true },
  { href: '/banner/dashboard', label: 'バナー作成', icon: Palette },
  { href: '/banner/dashboard/chat', label: 'AIチャット', icon: MessageSquare },
  { href: '/banner/gallery', label: 'ギャラリー', icon: Layers },
  { href: '/banner/dashboard/history', label: '履歴', icon: Clock },
  { href: '/banner/dashboard/plan', label: 'プラン・使用量', icon: CreditCard },
]

const seoNavItems: NavItem[] = [
  // /seo に「ダッシュボード＋生成履歴」を統合
  { href: '/seo', label: '生成記事一覧', icon: LayoutDashboard },
  { href: '/seo/create', label: '新規記事作成', icon: Sparkles },
]

// 以前の設定項目は削除
const settingsNavItems: NavItem[] = []

interface DashboardSidebarProps {
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
  isMobile?: boolean
}

function DashboardSidebarImpl({ 
  isCollapsed: controlledIsCollapsed, 
  onToggle, 
  forceExpanded,
  isMobile 
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isPro = useMemo(() => {
    const bannerPlan = String((session?.user as any)?.bannerPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    if (bannerPlan) return bannerPlan !== 'FREE'
    if (globalPlan) return globalPlan !== 'FREE'
    return false
  }, [session])

  const bannerPlanLabel = useMemo(() => {
    const bannerPlan = String((session?.user as any)?.bannerPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    const p = bannerPlan || globalPlan || (isLoggedIn ? 'FREE' : 'GUEST')
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return 'PRO'
    if (p === 'FREE') return 'FREE'
    return isLoggedIn ? 'FREE' : 'GUEST'
  }, [session, isLoggedIn])

  const nextBannerPlanLabel = useMemo(() => {
    if (bannerPlanLabel === 'GUEST' || bannerPlanLabel === 'FREE') return 'PRO'
    if (bannerPlanLabel === 'PRO') return 'ENTERPRISE'
    return 'CONSULT'
  }, [bannerPlanLabel])

  // 1時間生成し放題キャンペーン判定
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const [freeHourRemainingMs, setFreeHourRemainingMs] = useState(() => getFreeHourRemainingMs(firstLoginAt))
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)

  // 残り時間をリアルタイム更新
  useEffect(() => {
    if (!isFreeHourActive) return
    const interval = setInterval(() => {
      const remaining = getFreeHourRemainingMs(firstLoginAt)
      setFreeHourRemainingMs(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [isFreeHourActive, firstLoginAt])

  // 残り時間を「分:秒」形式に変換
  const formatRemainingTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 入力中の親コンポーネント再レンダーでサイドバーが“ぱちぱち”しないよう、
  // derived values をメモ化して framer-motion の不要な更新を抑える
  const isBanner = useMemo(() => pathname.startsWith('/banner'), [pathname])
  const activeNavItems = useMemo(() => (isBanner ? bannerNavItems : seoNavItems), [isBanner])

  const postLogoutUrl = useMemo(() => {
    // ログアウト後は「ゲストで閲覧可能な安全な場所」へ戻す
    if (pathname.startsWith('/banner')) return '/banner?loggedOut=1'
    if (pathname.startsWith('/kantan')) return '/kantan/dashboard?loggedOut=1'
    if (pathname.startsWith('/seo')) return '/seo?loggedOut=1'
    return '/?loggedOut=1'
  }, [pathname])

  const requestLogout = () => {
    if (!isLoggedIn || isLoggingOut) return
    setIsLogoutDialogOpen(true)
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      // 完了toastは遷移先で表示する（ログアウトはリダイレクトが入るため）
      markLogoutToastPending()
      await signOut({ callbackUrl: postLogoutUrl })
    } finally {
      // signOut が例外で落ちるケースに備えて閉じる
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const isCollapsed = forceExpanded ? false : (controlledIsCollapsed ?? internalIsCollapsed)
  const toggle = () => {
    const next = !isCollapsed
    if (onToggle) onToggle(next)
    else setInternalIsCollapsed(next)
  }

  const isActive = (href: string) => {
    const base = href.split('#')[0]
    if (base === '/banner' || base === '/banner/dashboard' || base === '/seo') {
      return pathname === base
    }
    return pathname.startsWith(base)
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    const Icon = item.icon
    const tourId = item.href.split('#')[0]
    // モバイル時は常に展開表示
    const showLabel = isMobile || !isCollapsed

    return (
      <Link href={item.href}>
        <motion.div
          whileHover={{ x: 4 }}
          data-tour-nav={tourId}
          className={`relative flex items-center gap-3 px-3 py-3.5 sm:py-2.5 rounded-xl transition-all cursor-pointer group ${
            active
              ? 'bg-white/15 text-white'
              : 'text-blue-100/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon className={`w-6 h-6 sm:w-5 sm:h-5 flex-shrink-0 ${active ? 'text-white' : 'text-blue-200/70 group-hover:text-white'}`} />
          
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

          {item.hot && showLabel && (
            <span className="ml-auto px-2 py-1 sm:px-1.5 sm:py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-xs sm:text-[10px] font-bold text-white rounded-md shadow-sm">
              HOT
            </span>
          )}

          {item.badge && showLabel && (
            <span className="ml-auto px-2.5 py-1 sm:px-2 sm:py-0.5 bg-white/20 text-xs sm:text-[10px] font-bold rounded-full">
              {item.badge}
            </span>
          )}

          {/* Active indicator */}
          {active && (
            <motion.div
              layoutId="activeIndicator"
              className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
            />
          )}
        </motion.div>
      </Link>
    )
  }

  const SectionTitle = ({ title }: { title: string }) => (
    <AnimatePresence>
      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="px-3 py-2 text-[10px] font-bold text-blue-200/50 uppercase tracking-wider"
        >
          {title}
        </motion.div>
      )}
    </AnimatePresence>
  )

  // 1時間生成し放題キャンペーンバナー（静的表示 - アニメーションなし）
  const FreeHourCampaignBanner = () => {
    if (!isFreeHourActive || freeHourRemainingMs <= 0) return null
    const showBanner = isMobile || !isCollapsed
    if (!showBanner) return null

    return (
      <div className="mx-3 md:mx-4 mt-3 md:mt-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 border border-amber-300/50 relative overflow-hidden shadow-lg shadow-amber-500/20">
        {/* 背景装飾 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/20 rounded-full blur-2xl pointer-events-none" />
        
        {/* PC用表示 */}
        <div className="hidden md:block relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-lg">🚀</span>
            </div>
            <div>
              <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/90 font-bold">全機能解放</p>
            <div className="px-2 py-1 bg-white/30 rounded-lg backdrop-blur-sm">
              <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
                残り {formatRemainingTime(freeHourRemainingMs)}
              </p>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-white/80 font-bold space-y-0.5">
            <p>✓ 最大10枚生成</p>
            <p>✓ サイズ指定OK</p>
            <p>✓ 履歴機能解放</p>
          </div>
        </div>

        {/* スマホ用表示 */}
        <div className="md:hidden relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <span className="text-xl">🚀</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
            <p className="text-[10px] text-white/80 font-bold">全機能解放 / 履歴OK</p>
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

  const SidebarBanner = () => {
    // 1時間生成し放題中はプラン案内バナーを非表示
    if (isFreeHourActive && freeHourRemainingMs > 0) return null

    // モバイル時は常に展開表示
    const showBanner = isMobile || !isCollapsed
    if (!showBanner) return null

    // スマホ表示: コンパクト1行 / PC表示: 縦レイアウトで詳細表示（静的表示）
    return (
      <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden group">
        {/* PC用：縦レイアウト（詳細表示） */}
        <div className="hidden md:block relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
            </div>
            <p className="text-xs font-black text-white">プラン案内</p>
          </div>
          <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
            現在：{bannerPlanLabel === 'GUEST' ? 'ゲスト' : bannerPlanLabel}
          </p>
          <p className="text-[10px] text-blue-100 font-bold leading-relaxed opacity-80">
            {nextBannerPlanLabel === 'PRO' && <>次の上位：PRO（¥9,980/月）</>}
            {nextBannerPlanLabel === 'ENTERPRISE' && <>次の上位：Enterprise（¥49,800/月）</>}
            {nextBannerPlanLabel === 'CONSULT' && <>さらに上限UP：要相談</>}
          </p>
          {nextBannerPlanLabel === 'CONSULT' ? (
            <a
              href={HIGH_USAGE_CONTACT_URL}
              target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
              rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
            >
              <button className="mt-3 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md">
                マーケティング丸投げ相談
              </button>
            </a>
          ) : (
            <Link href="/banner/pricing">
              <button className="mt-3 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md">
                {nextBannerPlanLabel === 'PRO' ? 'PROを始める' : 'Enterpriseへ'}
              </button>
            </Link>
          )}
        </div>

        {/* スマホ用：横1行コンパクト表示 */}
        <div className="md:hidden relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white font-bold leading-snug truncate">
              {bannerPlanLabel === 'GUEST' ? 'ゲスト' : bannerPlanLabel}
              {nextBannerPlanLabel === 'PRO' && ' → PRO'}
              {nextBannerPlanLabel === 'ENTERPRISE' && ' → Enterprise'}
              {nextBannerPlanLabel === 'CONSULT' && ' ✓'}
            </p>
          </div>
          {nextBannerPlanLabel === 'CONSULT' ? (
            <a
              href={HIGH_USAGE_CONTACT_URL}
              target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
              rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
              className="flex-shrink-0"
            >
              <button className="px-3 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md whitespace-nowrap">
                相談
              </button>
            </a>
          ) : (
            <Link href="/banner/pricing" className="flex-shrink-0">
              <button className="px-3 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md whitespace-nowrap">
                UP
              </button>
            </Link>
          )}
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
          x: 0, // モバイル時はコンテナ側で制御
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-[#2563EB] flex flex-col z-50 shadow-xl`}
      >
      {/* Logo - コンパクト版 */}
      <div className="px-3 sm:px-4 py-4 sm:py-5 flex items-center gap-2">
        <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
          <Sparkles className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
        </div>
        <AnimatePresence>
          {(isMobile || !isCollapsed) && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="overflow-hidden"
            >
              <h1 className="text-xl sm:text-lg font-black text-white tracking-tighter leading-none">ドヤバナーAI</h1>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-3 space-y-1 custom-scrollbar">
        {/* Active Tool Navigation */}
        <div className="space-y-1">
          <SectionTitle title={isBanner ? "ドヤバナーAI" : "Doya SEO"} />
          {activeNavItems.map((item) => (
            <NavLink key={item.href + item.label} item={item} />
          ))}
        </div>

      </nav>

      {/* 1時間生成し放題キャンペーンバナー */}
      <FreeHourCampaignBanner />

      {/* Side Banner（プラン案内） */}
      <SidebarBanner />

      {/* Support - コンパクト版 */}
      <div className="px-3 sm:px-4 pb-2">
        <a
          href={SUPPORT_CONTACT_URL}
          target="_blank"
          rel="noreferrer"
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
            !isMobile && isCollapsed ? 'justify-center' : ''
          }`}
          title="お問い合わせ（改善点・不具合）"
        >
          <HelpCircle className="w-5 h-5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
          <AnimatePresence>
            {(isMobile || !isCollapsed) && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="min-w-0"
              >
                <div className="text-sm sm:text-xs font-bold leading-none">お問い合わせ</div>
              </motion.div>
            )}
          </AnimatePresence>
        </a>
      </div>

      {/* User Profile - コンパクト版 */}
      <div className="p-2 sm:p-3 border-t border-white/5 bg-blue-700/30">
        <div className={`flex items-center gap-2 ${!isMobile && isCollapsed ? 'justify-center' : ''}`}>
          <Link
            href="/banner/dashboard/settings"
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
            title="設定"
          >
            <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
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
              {(isMobile || !isCollapsed) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm sm:text-xs font-bold text-white truncate">
                    {session?.user?.name || (isLoggedIn ? 'ユーザー' : 'ゲスト')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          {(isMobile || !isCollapsed) && (
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
                  href={
                    pathname.startsWith('/banner')
                      ? `/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/banner')}`
                      : `/auth/signin?callbackUrl=${encodeURIComponent(pathname || '/kantan/dashboard')}`
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-[#2563EB] text-[10px] font-black hover:bg-blue-50 transition-colors shadow-sm"
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
          className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100 z-10"
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
              className="px-4 py-4 text-center border-t border-white/5"
            >
              <p className="text-[10px] text-blue-100/30 font-bold tracking-widest">ドヤバナーAI</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* 右下の?＋初回ログイン時のサイドバー＋画面全体ツアー */}
      <SidebarTour
        storageKey={`doya_sidebar_tour_${isBanner ? 'banner' : 'seo'}_${String((session?.user as any)?.id || 'guest')}`}
        autoStart={!!session?.user}
        onEnsureExpanded={() => setInternalIsCollapsed(false)}
        items={[
          // 画面全体イントロ（/bannerの場合に主要UI要素もガイド）
          ...(isBanner
            ? [
                {
                  id: 'url-input',
                  label: 'URLを入力するだけでスタート',
                  description:
                    'バナーを作りたいサイトのURLを入力します。AIが内容を解析し、最適なバナーを自動生成します。',
                  targetSelector: '[data-tour="url-input"]',
                  allowMissing: true,
                },
                {
                  id: 'advanced-settings',
                  label: '詳細設定を開く',
                  description:
                    '生成枚数やサイズを指定できます。有料プランなら最大10枚・サイズ指定が可能です。',
                  targetSelector: '[data-tour="advanced-settings"]',
                  allowMissing: true,
                },
                {
                  id: 'generate-button',
                  label: '生成ボタンを押す',
                  description:
                    'ボタンを押すとAIがサイトを分析し、バナーを自動生成します。30秒〜1分ほどお待ちください。',
                  targetSelector: '[data-tour="generate-button"]',
                  allowMissing: true,
                },
                {
                  id: 'analysis-result',
                  label: '解析結果を確認',
                  description:
                    'AIが読み取ったサイトのポイントが表示されます。コピーや配色の根拠に使われます。',
                  targetSelector: '[data-tour="analysis-result"]',
                  allowMissing: true,
                },
                {
                  id: 'generated-results',
                  label: '生成されたバナーをダウンロード',
                  description:
                    '完成したバナーはここに表示されます。各画像のダウンロードボタンから保存できます。',
                  targetSelector: '[data-tour="generated-results"]',
                  allowMissing: true,
                },
                {
                  id: 'pricing-plans',
                  label: 'プランをアップグレード',
                  description:
                    '無料は1日3枚まで。有料プラン（PRO / Enterprise）なら最大500枚/日まで生成できます。',
                  targetSelector: '[data-tour="pricing-plans"]',
                  allowMissing: true,
                },
              ]
            : []),
          // サイドバー系（既存）
          {
            id: 'intro',
            label: 'サイドバーから機能を選ぶ',
            description: '左のサイドバーから、使いたい機能にすぐ移動できます。順番に確認してみましょう。',
            targetSelector: '[data-tour-nav]',
          },
          ...activeNavItems.map((it) => ({
            id: it.href,
            label: it.label,
            description:
              it.href.startsWith('/banner')
                ? 'この機能でバナー制作を進めます。クリックして画面を確認してみてください。'
                : 'この機能でSEO制作を進めます。クリックして画面を確認してみてください。',
            targetSelector: `[data-tour-nav="${it.href.split('#')[0]}"]`,
          })),
        ]}
      />

      {/* ログアウト確認（チャット風） */}
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
                <div className="flex items-start justify-end gap-2">
                  <div className="bg-blue-600 text-white rounded-2xl px-3 py-2">
                    <p className="text-sm font-black leading-relaxed">ログアウトする</p>
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

// props が変わらない限り再レンダーしない（入力中の“ぱちぱち”対策）
export default memo(DashboardSidebarImpl)

