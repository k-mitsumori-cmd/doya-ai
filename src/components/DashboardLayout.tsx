'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DashboardSidebar from './DashboardSidebar'
import { 
  Settings, 
  User,
  Menu,
  X,
  LogIn
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const isLoggedIn = !!session?.user

  // ローカルストレージから状態を復元（クライアントサイドのみ）
  React.useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  // 親（各ページ）が頻繁に再レンダーしても Sidebar が再レンダーされないように、
  // callback を安定化（memo(DashboardSidebar)が効くようにする）
  const handleToggle = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block">
        <DashboardSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      </div>

      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => setIsSidebarOpen(false)} 
            />
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[240px] shadow-2xl"
            >
              <DashboardSidebar forceExpanded isMobile />
              <button 
                className="absolute top-4 right-[-3.5rem] p-2 text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div 
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:pl-[72px]' : 'md:pl-[240px]'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-4">
              <button 
                className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              {/* 検索バーは削除 - ツールに集中するため */}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {isLoggedIn && (
                <>
                  <Link
                    href="/banner/dashboard/settings"
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="設定"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                  <div className="h-8 w-px bg-gray-200 mx-1 md:mx-2" />
                </>
              )}
              <div className="flex items-center gap-3 pl-1">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-900 leading-none mb-1">
                    {session?.user?.name || (isLoggedIn ? 'ユーザー' : 'ゲスト')}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest leading-none">
                    {isLoggedIn
                      ? (session?.user?.email === 'admin@bunridge.ai' || session?.user?.email === 'admin@doya-ai.com'
                          ? 'Administrator'
                          : 'General Member')
                      : 'Not signed in'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm overflow-hidden">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                {!isLoggedIn && (
                  <Link
                    href={
                      pathname.startsWith('/banner')
                        ? `/auth/doyamarke/signin?callbackUrl=${encodeURIComponent(pathname || '/banner')}`
                        : `/auth/signin?callbackUrl=${encodeURIComponent(pathname || '/kantan/dashboard')}`
                    }
                    className="h-9 px-3 rounded-xl bg-[#2563EB] text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    ログイン
                  </Link>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

