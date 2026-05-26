'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
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

export default function KintaiSidebar({ role, onClose }: KintaiSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        isActive(item.href)
          ? 'bg-[#7f19e6]/10 text-[#7f19e6] shadow-sm'
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
      {/* Logo */}
      <div className="p-4 border-b border-slate-100">
        <Link href="/kintai/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white shadow-lg shadow-[#7f19e6]/20">
            <span className="material-symbols-outlined text-xl">schedule</span>
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight">ドヤ勤怠</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Attendance</p>
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
              onClick={closeMobile}
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
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
