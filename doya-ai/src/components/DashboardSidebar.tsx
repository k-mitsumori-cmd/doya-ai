'use client'

import React, { memo, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Sparkles, 
  Clock, 
  BarChart3, 
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
  CreditCard
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { HIGH_USAGE_CONTACT_URL, SUPPORT_CONTACT_URL } from '@/lib/pricing'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string | number
  hot?: boolean
}

const bannerNavItems: NavItem[] = [
  { href: '/banner/dashboard', label: 'バナー作成', icon: Palette },
  { href: '/banner/dashboard/chat', label: 'AIチャット', icon: MessageSquare },
  { href: '/banner/gallery', label: 'ギャラリー', icon: Layers },
  { href: '/banner/dashboard/stats', label: '統計・分析', icon: BarChart3 },
  { href: '/banner/dashboard/history', label: '履歴', icon: Clock },
  { href: '/banner/dashboard/plan', label: 'プラン・使用量', icon: CreditCard },
]

const seoNavItems: NavItem[] = [
  { href: '/seo', label: 'SEOツール', icon: LayoutDashboard },
  { href: '/seo/new', label: '新規作成', icon: Sparkles },
  { href: '/seo/articles', label: '生成履歴', icon: Clock },
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

  const isPro = useMemo(() => {
    const bannerPlan = String((session?.user as any)?.bannerPlan || '').toUpperCase()
    const globalPlan = String((session?.user as any)?.plan || '').toUpperCase()
    if (bannerPlan) return bannerPlan !== 'FREE'
    if (globalPlan) return globalPlan !== 'FREE'
    return false
  }, [session])

  // 入力中の親コンポーネント再レンダーでサイドバーが“ぱちぱち”しないよう、
  // derived values をメモ化して framer-motion の不要な更新を抑える
  const isBanner = useMemo(() => pathname.startsWith('/banner'), [pathname])
  const activeNavItems = useMemo(() => (isBanner ? bannerNavItems : seoNavItems), [isBanner])

  const isCollapsed = forceExpanded ? false : (controlledIsCollapsed ?? internalIsCollapsed)
  const toggle = () => {
    const next = !isCollapsed
    if (onToggle) onToggle(next)
    else setInternalIsCollapsed(next)
  }

  const isActive = (href: string) => {
    if (href === '/banner/dashboard' || href === '/seo') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href)
    const Icon = item.icon

    return (
      <Link href={item.href}>
        <motion.div
          whileHover={{ x: 4 }}
          className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
            active
              ? 'bg-white/15 text-white'
              : 'text-blue-100/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-blue-200/70 group-hover:text-white'}`} />
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>

          {item.hot && !isCollapsed && (
            <span className="ml-auto px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-[10px] font-bold text-white rounded-md shadow-sm">
              HOT
            </span>
          )}

          {item.badge && !isCollapsed && (
            <span className="ml-auto px-2 py-0.5 bg-white/20 text-[10px] font-bold rounded-full">
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

  const SidebarBanner = () => (
    <AnimatePresence>
      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="mx-4 my-6 p-4 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden group"
        >
          <div className="absolute -right-2 -top-2 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
          <div className="relative z-10">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center mb-3 shadow-lg">
              <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
            </div>
            <h4 className="text-xs font-black text-white mb-1">PRO PLAN</h4>
            <p className="text-[10px] text-blue-100 font-bold leading-relaxed opacity-80">
              AI生成機能を無制限に。<br />高度な分析とチーム共有も。
            </p>
            {isPro ? (
              <a
                href={HIGH_USAGE_CONTACT_URL}
                target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
                rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
              >
                <button className="mt-3 w-full py-2 bg-white text-[#2563EB] text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                  マーケティング施策を丸投げする
                </button>
              </a>
            ) : (
              <Link href="/pricing">
                <button className="mt-3 w-full py-2 bg-white text-[#2563EB] text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                  アップグレード
                </button>
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isCollapsed ? 72 : 240,
        x: 0, // モバイル時はコンテナ側で制御
      }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-[#2563EB] flex flex-col z-50 shadow-xl`}
    >
      {/* Logo */}
      <div className="px-6 py-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="overflow-hidden"
            >
              <h1 className="text-2xl font-black text-white tracking-tighter leading-none">ドヤバナーAI</h1>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        {/* Active Tool Navigation */}
        <div className="space-y-1">
          <SectionTitle title={isBanner ? "ドヤバナーAI" : "Doya SEO"} />
          {activeNavItems.map((item) => (
            <NavLink key={item.href + item.label} item={item} />
          ))}
        </div>

      </nav>

      {/* Side Banner */}
      <SidebarBanner />

      {/* Support */}
      <div className="px-4 pb-3">
        <a
          href={SUPPORT_CONTACT_URL}
          target="_blank"
          rel="noreferrer"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="お問い合わせ（改善点・不具合）"
        >
          <HelpCircle className="w-5 h-5 text-white" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="min-w-0"
              >
                <div className="text-sm font-black leading-none">お問い合わせ</div>
                <div className="text-[10px] text-blue-100/70 font-bold mt-1 truncate">
                  改善点・エラー報告はこちら
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </a>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5 bg-blue-700/30">
        <div className={`flex items-center gap-3 p-2 rounded-xl ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt={session.user.name || 'User'} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-bold text-white truncate">
                  {session?.user?.name || (isLoggedIn ? 'ユーザー' : 'ゲスト')}
                </p>
                <p className="text-[10px] text-blue-100/60 truncate font-medium">
                  {session?.user?.email || '未ログイン'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!isCollapsed && (
            isLoggedIn ? (
              <button
                onClick={() => signOut()}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(pathname || '/banner/dashboard')}`}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white text-[#2563EB] text-[11px] font-black hover:bg-blue-50 transition-colors shadow-sm"
                title="ログイン"
              >
                <LogIn className="w-4 h-4" />
                ログイン
              </Link>
            )
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
            <p className="text-[10px] text-blue-100/30 font-bold tracking-widest">
              @GORO
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}

// props が変わらない限り再レンダーしない（入力中の“ぱちぱち”対策）
export default memo(DashboardSidebarImpl)

