'use client'

import { useState, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface DoyalistSidebarProps {
  userName?: string
  userImage?: string
  plan?: string
  creditsUsed?: number
  creditsTotal?: number
}

const NAV_ITEMS = [
  { href: '/doyalist/projects', icon: 'list_alt', label: 'リスト一覧', desc: '作成済みリストを管理' },
  { href: '/doyalist/new', icon: 'add_circle', label: '新規作成', desc: 'AIでリストを作る' },
  { href: '/doyalist/templates', icon: 'bookmark', label: 'テンプレート', desc: '条件を保存・再利用' },
  { href: '/doyalist/settings', icon: 'bar_chart', label: '利用状況', desc: '使用量と設定' },
]

const SUPPORT_ITEMS = [
  { href: '/doyalist/pricing', icon: 'payments', label: '料金プラン' },
  { href: '/doyalist/settings', icon: 'settings', label: '設定' },
]

export default function DoyalistSidebar({
  userName = 'ユーザー',
  userImage,
  plan = 'Free',
  creditsUsed = 0,
  creditsTotal = 3,
}: DoyalistSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const daysUntilReset = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const nextMonth = new Date(year, month + 1, 1)
    const diffMs = nextMonth.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }, [])

  const creditsRemaining = creditsTotal - creditsUsed
  const usedPercent = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0

  const isActive = (href: string) => {
    if (href === '/doyalist/projects') {
      return pathname === '/doyalist' || pathname === '/doyalist/projects' || pathname?.startsWith('/doyalist/projects/')
    }
    return pathname?.startsWith(href)
  }

  const sidebar = (
    <div
      className={`flex flex-col h-full bg-white ${isCollapsed ? 'w-[72px]' : 'w-[280px]'} transition-all duration-300 ease-in-out`}
    >
      {/* ── Logo area ── */}
      <div className="px-5 pt-5 pb-2">
        <Link href="/doyalist/projects" className="flex items-center gap-3 group">
          <motion.img
            src="/characters/hello_挨拶.png"
            alt="ドヤリストくん"
            className="w-10 h-10 object-contain flex-shrink-0 rounded-full cursor-pointer"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            whileTap={{ scale: 1.3, rotate: 10 }}
          />
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 leading-tight">ドヤリスト</h1>
              <p className="text-xs text-slate-400 leading-tight">AI営業リスト</p>
            </div>
          )}
        </Link>
      </div>

      {/* ── Quick action ── */}
      <div className={`px-4 pt-3 pb-1 ${isCollapsed ? 'px-3' : ''}`}>
        <Link
          href="/doyalist/new"
          className={`flex items-center justify-center gap-2 w-full bg-blue-50 text-blue-600 font-medium rounded-full py-2.5 hover:bg-blue-100 active:scale-[0.97] transition-all ${isCollapsed ? 'px-0' : 'px-4'}`}
        >
          <span className="material-symbols-outlined text-[22px]">add</span>
          {!isCollapsed && <span className="text-sm">新規作成</span>}
        </Link>
      </div>

      {/* ── Main navigation ── */}
      <nav className="flex-1 px-3 pt-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-2xl transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <motion.div
                className="flex items-center gap-3 px-4 py-3"
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span
                  className={`material-symbols-outlined text-[24px] flex-shrink-0 ${
                    active ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <span className={`block text-sm leading-snug ${active ? 'font-medium' : ''}`}>
                      {item.label}
                    </span>
                    <span className="block text-xs text-slate-400 leading-snug truncate">
                      {item.desc}
                    </span>
                  </div>
                )}
              </motion.div>
            </Link>
          )
        })}

        {/* ── Support section ── */}
        <div className="pt-4 mt-2">
          <div className="mx-4 mb-2 border-t border-slate-100" />
          {SUPPORT_ITEMS.map((item) => {
            const active = isActive(item.href) && item.label === '設定'
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`block rounded-2xl transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <motion.div
                  className="flex items-center gap-3 px-4 py-2.5"
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span
                    className={`material-symbols-outlined text-[22px] flex-shrink-0 ${
                      active ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="text-[13px]">{item.label}</span>}
                </motion.div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Credits section ── */}
      {!isCollapsed && (
        <div className="mx-3 mb-3 bg-slate-50 rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 mb-2">今月の利用</p>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
            <motion.div
              className="h-full bg-blue-400 rounded-full relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${usedPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
            </motion.div>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-700">
              残り <span className="font-semibold">{creditsRemaining}</span> / {creditsTotal} リスト
            </span>
            <motion.img
              src={creditsRemaining > creditsTotal * 0.2 ? "/characters/thumbsup_いいね.png" : "/characters/sleep_居眠り.png"}
              alt=""
              className="w-8 h-8 object-contain rounded-full"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mb-3">リセットまであと{daysUntilReset}日</p>
          <Link
            href="/doyalist/pricing"
            className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
          >
            アップグレード
          </Link>
        </div>
      )}

      {/* ── User profile ── */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {userImage ? (
            <img
              src={userImage}
              alt={userName}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold flex-shrink-0">
              {userName[0]}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className="text-sm font-medium text-slate-800 truncate">{userName}</p>
              <span className="text-xs rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 flex-shrink-0 font-medium">
                {plan}
              </span>
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
        aria-label="メニューを開く"
        className="lg:hidden fixed top-4 left-4 z-40 p-2.5 bg-white rounded-2xl shadow-md border border-slate-200 active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-[24px] text-slate-600">menu</span>
      </button>

      {/* Mobile overlay + slide-in */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 shadow-2xl"
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
