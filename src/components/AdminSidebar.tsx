'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  BarChart3,
  CreditCard,
  Shield,
  Home,
  ChevronRight,
  Zap,
  Crown,
  Image,
  FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'

const mainNavItems = [
  { icon: LayoutDashboard, label: 'ダッシュボード', href: '/admin', badge: null },
  { icon: Users, label: 'ユーザー管理', href: '/admin/users', badge: null },
  { icon: BarChart3, label: 'アナリティクス', href: '/admin/analytics', badge: null },
  { icon: CreditCard, label: '売上・課金', href: '/admin/billing', badge: null },
  { icon: Shield, label: '管理者アカウント', href: '/admin/admins', badge: null },
  { icon: Settings, label: '設定', href: '/admin/settings', badge: null },
]

const doyamanaNavItems = [
  { icon: Image, label: '画像・プロンプト管理', href: '/admin/doyamana-images', badge: null },
  { icon: FolderOpen, label: 'カテゴリ管理', href: '/admin/doyamana-categories', badge: null },
]

const serviceLinks = [
  { emoji: '🎨', label: 'ドヤバナーAI', href: '/banner/dashboard', gradient: 'from-violet-500 to-fuchsia-500' },
  { emoji: '✍️', label: 'ドヤライティングAI', href: '/seo/dashboard', gradient: 'from-emerald-500 to-cyan-500' },
]

export function AdminSidebar({ isMobile }: { isMobile?: boolean } = {}) {
  const pathname = usePathname()
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
      window.location.href = '/admin/login'
    } catch {
      toast.error('ログアウトに失敗しました')
    }
  }

  return (
    <aside className={isMobile ? 'flex w-64 bg-[#0D0D12] h-full flex-col' : 'hidden md:flex w-64 bg-[#0D0D12] border-r border-white/5 h-screen sticky top-0 flex-col'}>
      {/* Logo Section */}
      <div className="p-5 border-b border-white/5">
        <Link href="/admin" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0D0D12] flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">✓</span>
            </div>
          </div>
          <div>
            <span className="font-bold text-white block">ドヤAI</span>
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <Crown className="w-3 h-3" />
              Admin Console
            </span>
          </div>
        </Link>
      </div>

      {/* User Info */}
      {/* 管理者セッション情報の表示は /api/admin/auth/session で取得する設計だが、
          ここでは簡略化して省略（必要なら後で追加） */}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">
          メニュー
        </p>
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all relative ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-violet-400 to-fuchsia-400 rounded-full"
                    />
                  )}
                  <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-violet-400' : ''}`} />
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-violet-400" />}
                </motion.div>
              </Link>
            )
          })}
        </div>

        {/* Doyamana AI Section */}
        <div className="mt-8">
          <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">
            ドヤマナAI 管理
          </p>
          <div className="space-y-1">
            {doyamanaNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ x: 4 }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all relative ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeDoyamanaIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full"
                      />
                    )}
                    <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-emerald-400' : ''}`} />
                    <span className="font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto text-emerald-400" />}
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Services Section */}
        <div className="mt-8">
          <p className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">
            サービス
          </p>
          <div className="space-y-2">
            {serviceLinks.map((service) => (
              <Link key={service.href} href={service.href}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-3 rounded-xl bg-gradient-to-r from-white/[0.02] to-white/[0.05] border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{service.emoji}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                        {service.label}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent border border-violet-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white/60">本日の統計</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-lg font-bold text-white">431</p>
              <p className="text-[10px] text-white/40">生成数</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">+12</p>
              <p className="text-[10px] text-white/40">新規ユーザー</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <Link href="/">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/5 hover:text-white transition-all mb-2"
          >
            <Home className="w-4 h-4" />
            <span className="font-medium">ポータルへ戻る</span>
          </motion.div>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">ログアウト</span>
        </button>
      </div>
    </aside>
  )
}
