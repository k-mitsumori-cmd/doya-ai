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
  Layers
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string | number
  hot?: boolean
}

const mainNavItems: NavItem[] = [
  { href: '/banner', label: 'バナー生成', icon: Sparkles, hot: true },
  { href: '/banner/dashboard/chat', label: 'AIチャット', icon: MessageSquare },
  { href: '/banner/dashboard/history', label: '生成履歴', icon: Clock },
  { href: '/banner/dashboard/stats', label: '効果分析', icon: BarChart3 },
]

const dataNavItems: NavItem[] = [
  { href: '/banner/dashboard/stats', label: 'アナリティクス', icon: TrendingUp },
  { href: '/banner/dashboard/plan', label: 'プラン', icon: Layers },
]

const settingsNavItems: NavItem[] = [
  { href: '/banner/dashboard/brand', label: 'ブランド設定', icon: Palette },
  { href: '#', label: 'お知らせ', icon: Bell },
  { href: '#', label: 'ヘルプ', icon: HelpCircle },
]

export default function DashboardSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/banner') {
      return pathname === '/banner' || pathname === '/banner/dashboard'
    }
    return pathname === href || pathname.startsWith(href + '/')
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

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-blue-600 flex flex-col z-50 shadow-xl shadow-blue-900/10"
    >
      {/* Logo */}
      <div className="px-4 py-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="overflow-hidden"
            >
              <h1 className="text-xl font-black text-white tracking-tight leading-none">Bunridge</h1>
              <p className="text-[10px] text-blue-100/60 mt-1 font-medium tracking-wider uppercase">Analytics Portal</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink key={item.href + item.label} item={item} />
          ))}
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
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100 z-10"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

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

