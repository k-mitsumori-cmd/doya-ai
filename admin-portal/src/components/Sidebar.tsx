'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, Users, BarChart3, Settings, LogOut, 
  Sparkles, ChevronRight, ExternalLink, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SERVICES } from '@/lib/services'
import toast from 'react-hot-toast'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const mainMenuItems = [
    { icon: LayoutDashboard, label: '統合ダッシュボード', href: '/' },
    { icon: Users, label: 'ユーザー管理', href: '/users' },
    { icon: BarChart3, label: '収益レポート', href: '/revenue' },
    { icon: Settings, label: '設定', href: '/settings' },
    { icon: HelpCircle, label: '使い方ガイド', href: '/guide' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('ログアウトしました')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('エラーが発生しました')
    }
  }

  return (
    <aside className="fixed top-0 left-0 z-40 w-64 h-screen bg-slate-900 text-white flex flex-col">
      {/* ロゴ */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg">ドヤシリーズ</span>
            <span className="text-xs text-slate-400 block -mt-0.5">管理ポータル</span>
          </div>
        </Link>
      </div>

      {/* メインナビゲーション */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          メニュー
        </p>
        {mainMenuItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all",
                  active
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          )
        })}

        {/* サービス一覧 */}
        <div className="pt-6 mt-6 border-t border-slate-800">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            サービス
          </p>
          {SERVICES.map((service) => {
            const active = pathname.startsWith(`/${service.id}`)
            return (
              <Link key={service.id} href={`/${service.id}`}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group",
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <span className="text-xl">{service.icon}</span>
                  <span className="font-medium flex-1">{service.shortName}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* 外部リンク */}
        <div className="pt-6 mt-6 border-t border-slate-800">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            外部リンク
          </p>
          {SERVICES.map((service) => (
            <a
              key={service.id}
              href={service.apiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-all text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{service.name}を開く</span>
            </a>
          ))}
        </div>
      </nav>

      {/* ログアウト */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="w-5 h-5" />
          ログアウト
        </button>
      </div>
    </aside>
  )
}

