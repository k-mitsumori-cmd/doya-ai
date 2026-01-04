'use client'

import React, { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  LogOut,
  LogIn,
  User,
  Zap,
  LayoutGrid,
  Image,
  FileText,
  ExternalLink,
  Target,
  Loader2,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { PERSONA_PRICING, SUPPORT_CONTACT_URL } from '@/lib/pricing'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string | number
  hot?: boolean
}

const personaNavItems: NavItem[] = [
  { href: '/persona', label: 'ペルソナ生成（URL）', icon: Target, hot: true },
  { href: '/persona/detail', label: 'ペルソナ生成（詳細版）', icon: FileText },
]

interface PersonaSidebarProps {
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
  isMobile?: boolean
}

function PersonaSidebarImpl({
  isCollapsed: controlledIsCollapsed,
  onToggle,
  forceExpanded,
  isMobile,
}: PersonaSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)
  const isLoggedIn = !!session?.user
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)

  const planLabel = isLoggedIn ? 'FREE' : 'GUEST'

  const isCollapsed = forceExpanded ? false : (controlledIsCollapsed ?? internalIsCollapsed)
  const showLabel = isMobile || !isCollapsed

  const toggle = () => {
    const next = !isCollapsed
    if (onToggle) onToggle(next)
    else setInternalIsCollapsed(next)
  }

  const isActive = (href: string) => {
    if (href === '/persona') return pathname === '/persona'
    return pathname.startsWith(href)
  }

  const confirmLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await signOut({ callbackUrl: '/persona?loggedOut=1' })
    } finally {
      setIsLoggingOut(false)
      setIsLogoutDialogOpen(false)
    }
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    const Icon = item.icon

    return (
      <Link href={item.href}>
        <motion.div
          whileHover={{ x: 4 }}
          className={`relative flex items-center gap-3 px-3 py-3.5 sm:py-2.5 rounded-xl transition-all cursor-pointer group ${
            active
              ? 'bg-white/15 text-white'
              : 'text-purple-100/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon className={`w-6 h-6 sm:w-5 sm:h-5 flex-shrink-0 ${active ? 'text-white' : 'text-purple-200/70 group-hover:text-white'}`} />

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

          {active && (
            <motion.div
              layoutId="personaActiveIndicator"
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
          className="px-3 py-2 text-[10px] font-bold text-purple-200/50 uppercase tracking-wider"
        >
          {title}
        </motion.div>
      )}
    </AnimatePresence>
  )

  const SidebarBanner = () => {
    const showBanner = isMobile || !isCollapsed
    if (!showBanner) return null

    return (
      <div className="mx-3 md:mx-4 my-2 md:my-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
        <div className="hidden md:block relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
              <Zap className="w-4 h-4 text-purple-600 fill-purple-600" />
            </div>
            <p className="text-xs font-black text-white">プラン案内</p>
          </div>
          <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
            現在：{planLabel === 'GUEST' ? 'ゲスト' : planLabel}
          </p>
          <p className="text-[10px] text-purple-100 font-bold leading-relaxed opacity-80">
            PROプラン：¥9,980/月
          </p>
          <Link
            href="/pricing"
            className="mt-3 w-full py-2 bg-white text-purple-600 text-[11px] font-black rounded-lg hover:bg-purple-50 transition-colors shadow-md block text-center"
          >
            PROを始める
          </Link>
        </div>

        <Link
          href="/pricing"
          className="md:hidden relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <Zap className="w-4 h-4 text-purple-600 fill-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white font-bold leading-snug truncate">
              {planLabel === 'GUEST' ? 'ゲスト' : planLabel} → PRO
            </p>
          </div>
          <span className="flex-shrink-0 px-3 py-1.5 bg-white text-purple-600 text-[10px] font-black rounded-lg hover:bg-purple-50 transition-colors shadow-md whitespace-nowrap">
            UP
          </span>
        </Link>
      </div>
    )
  }

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-gradient-to-b from-purple-600 via-purple-700 to-purple-800 flex flex-col z-50 shadow-xl`}
      >
        {/* Logo */}
        <div className="px-3 sm:px-4 py-4 sm:py-5 flex items-center gap-2">
          <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
            <Target className="w-5 h-5 sm:w-5 sm:h-5 text-white" />
          </div>
          <AnimatePresence>
            {showLabel && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="text-xl sm:text-lg font-black text-white tracking-tighter leading-none">ドヤペルソナAI</h1>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-3 space-y-1 custom-scrollbar">
          <div className="space-y-1">
            <SectionTitle title="ドヤペルソナAI" />
            {personaNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </nav>

        {/* Side Banner */}
        <SidebarBanner />

        {/* 他のAIツールも使う */}
        <div className="px-3 sm:px-4 pb-2">
          <div className="relative">
            <button
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/20 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 transition-all text-white ${
                !isMobile && isCollapsed ? 'justify-center' : 'justify-between'
              }`}
              type="button"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
                <AnimatePresence>
                  {showLabel && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      className="text-sm sm:text-xs font-bold"
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

                    {/* ドヤペルソナAI - 現在使用中 */}
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-purple-50 border border-purple-100">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Target className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-purple-600">ドヤペルソナAI</p>
                        <p className="text-[10px] font-bold text-purple-500">ペルソナ生成（現在使用中）</p>
                      </div>
                    </div>

                    {/* ドヤバナーAI */}
                    <a
                      href="/banner"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
                      onClick={() => setIsToolsMenuOpen(false)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Image className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">ドヤバナーAI</p>
                        <p className="text-[10px] font-bold text-gray-500">広告バナー生成</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" />
                    </a>

                    {/* ドヤライティングAI */}
                    <a
                      href="/seo"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-emerald-50 transition-colors group"
                      onClick={() => setIsToolsMenuOpen(false)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-emerald-600 transition-colors">ドヤライティングAI</p>
                        <p className="text-[10px] font-bold text-gray-500">SEO記事生成</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400" />
                    </a>

                    {/* カンタンマーケAI */}
                    <a
                      href="/kantan"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-orange-50 transition-colors group"
                      onClick={() => setIsToolsMenuOpen(false)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 group-hover:text-orange-600 transition-colors">カンタンマーケAI</p>
                        <p className="text-[10px] font-bold text-gray-500">マーケティング支援</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400" />
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

        {/* Support */}
        <div className="px-3 sm:px-4 pb-2">
          <a
            href={SUPPORT_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
              !isMobile && isCollapsed ? 'justify-center' : ''
            }`}
          >
            <HelpCircle className="w-5 h-5 sm:w-4 sm:h-4 text-white flex-shrink-0" />
            <AnimatePresence>
              {showLabel && (
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

        {/* User Profile */}
        <div className="p-2 sm:p-3 border-t border-white/5 bg-purple-900/30">
          <div className={`flex items-center gap-2 ${!isMobile && isCollapsed ? 'justify-center' : ''}`}>
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0">
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
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
                    <p className="text-sm sm:text-xs font-bold text-white truncate">
                      {session?.user?.name || (isLoggedIn ? 'ユーザー' : 'ゲスト')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {showLabel && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {isLoggedIn ? (
                  <button
                    onClick={() => setIsLogoutDialogOpen(true)}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="ログアウト"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/persona')}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-purple-600 text-[10px] font-black hover:bg-purple-50 transition-colors shadow-sm"
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
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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
              <p className="text-[10px] text-purple-100/30 font-bold tracking-widest">ドヤペルソナAI</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* ログアウト確認 */}
      <AnimatePresence>
        {isLogoutDialogOpen && (
          <motion.div
            key="logout-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center p-4"
            onClick={() => !isLoggingOut && setIsLogoutDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
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
                    <p className="mt-1 text-[11px] font-bold text-slate-500">いつでも再ログインできます。</p>
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
                  {isLoggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
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

export default memo(PersonaSidebarImpl)
