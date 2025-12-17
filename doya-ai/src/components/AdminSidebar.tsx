'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Sparkles,
  BarChart3,
  CreditCard,
  Shield,
  Home,
} from 'lucide-react'

// メインナビゲーション
const mainNavItems = [
  { icon: LayoutDashboard, label: 'ダッシュボード', href: '/admin' },
  { icon: Users, label: 'ユーザー管理', href: '/admin/users' },
  { icon: FileText, label: 'テンプレート', href: '/admin/templates' },
  { icon: BarChart3, label: '統計', href: '/admin/analytics' },
  { icon: CreditCard, label: '売上', href: '/admin/billing' },
  { icon: Settings, label: '設定', href: '/admin/settings' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-gray-900 text-white h-screen sticky top-0 flex flex-col">
      {/* ロゴ */}
      <div className="p-4 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm">ドヤAI</span>
            <div className="flex items-center gap-1 text-[10px] text-amber-400">
              <Shield className="w-2.5 h-2.5" />
              Admin
            </div>
          </div>
        </Link>
      </div>

      {/* メインナビ */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* サービス別リンク */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <p className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            サービス
          </p>
          <div className="space-y-1">
            <Link
              href="/kantan/dashboard"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
            >
              <span className="text-base">📝</span>
              <span>カンタンドヤAI</span>
            </Link>
            <Link
              href="/banner/dashboard"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
            >
              <span className="text-base">🎨</span>
              <span>ドヤバナーAI</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* 下部 */}
      <div className="p-3 border-t border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition-all"
        >
          <Home className="w-4 h-4" />
          <span>ポータルへ</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  )
}
