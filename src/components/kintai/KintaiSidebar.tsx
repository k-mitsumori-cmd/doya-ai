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
    { href: '/kintai/dashboard', icon: <LayoutDashboard size={20} />, label: 'マイページ' },
    { href: '/kintai/clock', icon: <Clock size={20} />, label: '打刻' },
    { href: '/kintai/attendance', icon: <CalendarDays size={20} />, label: '勤怠一覧' },
    { href: '/kintai/requests', icon: <FileText size={20} />, label: '申請' },
  ]

  const managerItems: NavItem[] = hasMinRole(role, 'manager')
    ? [
        { href: '/kintai/approvals', icon: <CheckSquare size={20} />, label: '承認' },
        { href: '/kintai/admin/attendance', icon: <BarChart3 size={20} />, label: '部署勤怠' },
      ]
    : []

  const adminItems: NavItem[] = hasMinRole(role, 'hr_admin')
    ? [
        { href: '/kintai/employees', icon: <Users size={20} />, label: '従業員管理' },
        { href: '/kintai/departments', icon: <Building2 size={20} />, label: '部署管理' },
        { href: '/kintai/settings', icon: <Settings size={20} />, label: '就業ルール' },
      ]
    : []

  const renderLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={closeMobile}
      className={`sidebar-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        isActive(item.href)
          ? 'bg-[#7f19e6]/10 text-[#7f19e6] shadow-sm sidebar-nav-active'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span className={isActive(item.href) ? 'text-[#7f19e6]' : 'text-slate-400'}>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  )

  const sidebar = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-60 transition-all duration-300">
      {/* Logo with Bear */}
      <div className="p-4 border-b border-slate-100">
        <Link href="/kintai/dashboard" className="sidebar-logo-link flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white shadow-lg shadow-[#7f19e6]/20 relative overflow-hidden">
            <span className="material-symbols-outlined text-xl">schedule</span>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-tight">ドヤ勤怠</h1>
              <p className="text-[10px] text-slate-400 tracking-wider">勤怠管理</p>
            </div>
            <img
              src="/kintai/characters/hello_挨拶.png"
              alt="くま"
              className="w-8 h-8 object-contain sidebar-logo-bear"
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

      <style jsx>{`
        @keyframes sidebarLogoWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(8deg); }
        }
        .sidebar-logo-link:hover .sidebar-logo-bear {
          animation: sidebarLogoWiggle 0.5s ease-in-out;
        }
        @keyframes sidebarNavBounce {
          0% { transform: translateX(0); }
          30% { transform: translateX(3px); }
          60% { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        .sidebar-nav-active {
          animation: sidebarNavBounce 0.3s ease-out;
        }
        .sidebar-nav-item:hover {
          transform: scale(1.02);
        }
        @keyframes sidebarCheerFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .sidebar-cheer-bear {
          animation: sidebarCheerFloat 3s ease-in-out infinite;
        }
        @keyframes cheerTextFade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .sidebar-cheer-text {
          animation: cheerTextFade 0.4s ease-out;
        }
      `}</style>
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

      <style jsx>{`
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .sidebar-mobile-overlay {
          animation: overlayFadeIn 0.2s ease-out;
        }
        @keyframes slideInLeft {
          from { transform: translateX(-260px); }
          to { transform: translateX(0); }
        }
        .sidebar-mobile-slide {
          animation: slideInLeft 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>
    </>
  )
}
