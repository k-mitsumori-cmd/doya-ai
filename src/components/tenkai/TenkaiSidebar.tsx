'use client'

import { useState, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface TenkaiSidebarProps {
  userName?: string
  userImage?: string
  plan?: string
  creditsUsed?: number
  creditsTotal?: number
}

const NAV_ITEMS = [
  { href: '/tenkai/projects', icon: 'dashboard', label: 'プロジェクト' },
  { href: '/tenkai/templates', icon: 'description', label: 'テンプレート', badge: 'NEW' },
  { href: '/tenkai/brand-voice', icon: 'record_voice_over', label: 'ブランドボイス' },
  { href: '/tenkai/settings', icon: 'bar_chart', label: '利用状況' },
]

const SUPPORT_ITEMS = [
  { href: '/tenkai/help', icon: 'help', label: 'ヘルプ' },
  { href: '/tenkai/settings', icon: 'settings', label: '設定' },
]

export default function TenkaiSidebar({
  userName = 'ユーザー',
  userImage,
  plan = 'Free',
  creditsUsed = 0,
  creditsTotal = 10,
}: TenkaiSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // 月末リセットまでの残り日数を計算
  const daysUntilReset = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    // 翌月1日を取得して、今日との差分を計算
    const nextMonth = new Date(year, month + 1, 1)
    const diffMs = nextMonth.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }, [])

  const isActive = (href: string) => {
    if (href === '/tenkai/projects') {
      return pathname === '/tenkai' || pathname === '/tenkai/projects' || pathname?.startsWith('/tenkai/projects/')
    }
    return pathname?.startsWith(href)
  }

  const sidebar = (
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300`}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-100">
        <Link href="/tenkai/projects" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-tight">Doya Tenkai AI</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">AI Repurposing</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(item.href)
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${isActive(item.href) ? 'text-blue-600' : 'text-slate-400'}`}>
              {item.icon}
            </span>
            {!isCollapsed && (
              <>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-md uppercase">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </Link>
        ))}

        {/* Support Section */}
        <div className="pt-4 mt-4 border-t border-slate-100">
          <p className={`px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${isCollapsed ? 'hidden' : ''}`}>
            サポート
          </p>
          {SUPPORT_ITEMS.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.href) && item.label === '設定'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-xl text-slate-400">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Usage Credits */}
      {!isCollapsed && (
        <div className="p-4 mx-3 mb-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">利用クレジット</span>
            <span className="text-sm font-bold text-blue-600">{creditsUsed}/{creditsTotal}</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(creditsUsed / Math.max(creditsTotal, 1)) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mb-2">月末リセットまであと{daysUntilReset}日</p>
          <Link
            href="/tenkai/pricing"
            className="block w-full py-2 text-center text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            プランをアップグレード
          </Link>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            {userName[0]}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400">{plan} プラン</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
      >
        <span className="material-symbols-outlined text-slate-600">menu</span>
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/30 z-40"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">
        {sidebar}
      </div>
    </>
  )
}
