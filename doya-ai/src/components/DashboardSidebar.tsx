'use client'

import { useState } from 'react'
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
  Bell,
  HelpCircle,
  LogOut,
  User,
  Zap,
  TrendingUp,
  Layers,
  Mail,
  Calendar,
  CreditCard,
  Users
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

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
  { href: '/banner/dashboard/stats', label: '統計・分析', icon: BarChart3 },
  { href: '/banner/dashboard/history', label: '履歴', icon: Clock },
  { href: '/banner/dashboard/plan', label: 'プラン・使用量', icon: CreditCard },
]

const seoNavItems: NavItem[] = [
  { href: '/seo', label: 'SEOツール', icon: LayoutDashboard },
  { href: '/seo/new', label: '新規作成', icon: Sparkles },
  { href: '/seo/articles', label: '生成履歴', icon: Clock },
]

const mainNavItems: NavItem[] = [
  { href: '/news', label: 'お知らせ', icon: Bell },
  { href: '/mail', label: 'メール', icon: Mail },
  { href: '/calendar', label: 'カレンダー', icon: Calendar },
]

const dataNavItems: NavItem[] = [
  { href: '/customers', label: '顧客情報', icon: Users },
]

// 以前の設定項目は削除
const settingsNavItems: NavItem[] = []

interface DashboardSidebarProps {
  isCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean
  isMobile?: boolean
}

export default function DashboardSidebar({ 
  isCollapsed: controlledIsCollapsed, 
  onToggle, 
  forceExpanded,
  isMobile 
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false)

  const isBanner = pathname.startsWith('/banner')
  const activeNavItems = isBanner ? bannerNavItems : seoNavItems

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
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"
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
            <Link href="/pricing">
              <button className="mt-3 w-full py-2 bg-white text-[#2563EB] text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                アップグレード
              </button>
            </Link>
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
        x: isMobile ? 0 : 0 // モバイル時はコンテナ側で制御
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

        {/* System Navigation */}
        <div className="pt-6">
          <SectionTitle title="システム" />
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLink key={item.href + item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Data Section */}
        <div className="pt-6">
          <SectionTitle title="データベース" />
          <div className="space-y-1">
            {dataNavItems.map((item) => (
              <NavLink key={item.href + item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Settings Section */}
        <div className="pt-6">
          <SectionTitle title="設定" />
          <div className="space-y-1">
            {settingsNavItems.map((item) => (
              <NavLink key={item.href + item.label} item={item} />
            ))}
          </div>
        </div>
      </nav>

      {/* Side Banner */}
      <SidebarBanner />

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
                  {session?.user?.name || '田中 太郎'}
                </p>
                <p className="text-[10px] text-blue-100/60 truncate font-medium">
                  {session?.user?.email || 'Admin'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!isCollapsed && session && (
            <button
              onClick={() => signOut()}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
            </button>
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

