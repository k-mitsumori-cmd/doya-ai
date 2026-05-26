'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface HrSidebarProps {
  userName?: string
  userImage?: string
  plan?: string
  employeeCount?: number
  employeeLimit?: number
}

const NAV_ITEMS = [
  { href: '/hr/dashboard', icon: 'dashboard', label: 'ダッシュボード' },
  { href: '/hr/employees', icon: 'people', label: '従業員' },
  { href: '/hr/org-chart', icon: 'account_tree', label: '組織図' },
  { href: '/hr/evaluations', icon: 'assessment', label: '評価' },
  { href: '/hr/one-on-one', icon: 'forum', label: '1on1' },
]

const SUPPORT_ITEMS = [
  { href: '/hr/settings', icon: 'settings', label: '設定' },
  { href: '/hr/pricing', icon: 'payments', label: '料金プラン' },
]

export default function HrSidebar({
  userName = 'ユーザー',
  userImage,
  plan = 'Free',
  employeeCount = 0,
  employeeLimit = 5,
}: HrSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/hr/dashboard') {
      return pathname === '/hr/dashboard'
    }
    return pathname?.startsWith(href)
  }

  const sidebar = (
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300`}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-100">
        <Link href="/hr/dashboard" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <span className="material-symbols-outlined text-2xl">groups</span>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-black text-slate-900 text-base leading-tight">ドヤHR</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-wider">タレントマネジメント</p>
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
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base transition-all ${
              isActive(item.href)
                ? 'bg-sky-100 text-sky-700 font-black border-l-4 border-sky-500 shadow-sm'
                : 'text-slate-700 font-bold hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span className={`material-symbols-outlined text-2xl ${isActive(item.href) ? 'text-sky-600' : 'text-slate-500'}`}>
              {item.icon}
            </span>
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* Support Section */}
        <div className="pt-4 mt-4 border-t border-slate-100">
          <p className={`px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider ${isCollapsed ? 'hidden' : ''}`}>
            管理
          </p>
          {SUPPORT_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base transition-all ${
                isActive(item.href)
                  ? 'bg-sky-100 text-sky-700 font-black border-l-4 border-sky-500'
                  : 'text-slate-700 font-bold hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-2xl text-slate-500">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Employee Count */}
      {!isCollapsed && (
        <div className="p-4 mx-3 mb-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">従業員数</span>
            <span className="text-lg font-black text-sky-600">
              {employeeCount}/{employeeLimit === -1 ? '∞' : employeeLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${employeeLimit === -1 ? 10 : (employeeCount / Math.max(employeeLimit, 1)) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <Link
            href="/hr/pricing"
            className="block w-full py-2 text-center text-xs font-bold text-sky-600 bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors"
          >
            プランをアップグレード
          </Link>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2">
          {userImage ? (
            <img src={userImage} alt={userName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {userName[0]}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-900 truncate">{userName}</p>
              <p className="text-xs font-bold text-slate-500">{plan} プラン</p>
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
