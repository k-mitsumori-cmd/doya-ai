'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  FileText,
  CheckSquare,
  BarChart3,
  Users,
  Building2,
  Settings,
} from 'lucide-react'
import { hasMinRole } from '@/lib/kintai/access-client'

interface KintaiSidebarProps {
  role: string
  onClose?: () => void
}

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
}

const CHEER_MESSAGES = [
  '今日もがんばろう！',
  'いい調子です！',
  '応援してるよ！',
  '素敵な一日を！',
  'ファイトです！',
  '休憩も大事だよ！',
]

export default function KintaiSidebar({ role, onClose }: KintaiSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [cheerIndex, setCheerIndex] = useState(0)

  // Rotate cheer message every 30 seconds
  useEffect(() => {
    setCheerIndex(Math.floor(Math.random() * CHEER_MESSAGES.length))
    const timer = setInterval(() => {
      setCheerIndex((prev) => (prev + 1) % CHEER_MESSAGES.length)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const isActive = (href: string) => {
    if (href === '/kintai/dashboard') {
      return pathname === '/kintai/dashboard'
    }
    return pathname?.startsWith(href)
  }

  const closeMobile = () => {
    setIsMobileOpen(false)
    onClose?.()
  }

  const baseItems: NavItem[] = [
    { href: '/kintai/dashboard', icon: <span className="text-lg">📊</span>, label: 'マイページ' },
    { href: '/kintai/clock', icon: <span className="text-lg">⏰</span>, label: '打刻' },
    { href: '/kintai/attendance', icon: <span className="text-lg">📅</span>, label: '勤怠一覧' },
    { href: '/kintai/requests', icon: <span className="text-lg">📝</span>, label: '申請' },
  ]

  const managerItems: NavItem[] = hasMinRole(role, 'manager')
    ? [
        { href: '/kintai/approvals', icon: <span className="text-lg">✅</span>, label: '承認' },
        { href: '/kintai/admin/attendance', icon: <span className="text-lg">📈</span>, label: '部署勤怠' },
      ]
    : []

  const adminItems: NavItem[] = hasMinRole(role, 'hr_admin')
    ? [
        { href: '/kintai/employees', icon: <span className="text-lg">👥</span>, label: '従業員管理' },
        { href: '/kintai/departments', icon: <span className="text-lg">🏢</span>, label: '部署管理' },
        { href: '/kintai/settings', icon: <span className="text-lg">⚙️</span>, label: '就業ルール' },
      ]
    : []

  const renderLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={closeMobile}
      className={`sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-full text-base transition-all ${
        isActive(item.href)
          ? 'bg-purple-100 text-[#7f19e6] font-black shadow-sm sidebar-nav-active'
          : 'text-slate-700 font-bold hover:bg-slate-100'
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  )

  const sidebar = (
    <div className="flex flex-col h-full bg-gray-50 w-64 transition-all duration-300">
      {/* Logo with Bear */}
      <div className="p-4 mb-1">
        <Link href="/kintai/dashboard" className="sidebar-logo-link flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white shadow-lg shadow-[#7f19e6]/30">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="font-black text-slate-900 text-base leading-tight">ドヤ勤怠</h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-wider">勤怠管理</p>
            </div>
            <img
              src="/kintai/characters/hello_挨拶.png"
              alt="くま"
              className="w-9 h-9 object-contain sidebar-logo-bear"
            />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {baseItems.map(renderLink)}

        {managerItems.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              管理
            </p>
            {managerItems.map(renderLink)}
          </div>
        )}

        {adminItems.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              設定
            </p>
            {adminItems.map(renderLink)}
          </div>
        )}
      </nav>

      {/* Plan link */}
      <div className="px-3 mb-2">
        <Link href="/kintai/pricing" onClick={closeMobile}
          className="flex items-center gap-3 px-4 py-3 rounded-full text-base font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all">
          <span className="text-lg">💎</span>
          料金プラン
        </Link>
      </div>

      {/* Bottom section with bear and cheer message */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-2xl bg-gradient-to-r from-[#7f19e6]/5 to-purple-50">
          <img
            src="/kintai/characters/thumbsup_いいね.png"
            alt="応援くま"
            className="w-10 h-10 object-contain sidebar-cheer-bear"
          />
          <p className="text-xs font-bold text-[#7f19e6]/80 leading-snug sidebar-cheer-text">
            {CHEER_MESSAGES[cheerIndex]}
          </p>
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

      {/* Mobile overlay + slide-in sidebar (CSS-only, no framer-motion) */}
      {isMobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-40 sidebar-mobile-overlay"
            onClick={closeMobile}
          />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 z-50 sidebar-mobile-slide">
            {sidebar}
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">
        {sidebar}
      </div>
    </>
  )
}
