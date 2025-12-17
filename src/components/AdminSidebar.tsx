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
  ChevronDown,
  Mic,
  Briefcase,
  MessageSquare,
  Megaphone,
  Image,
} from 'lucide-react'
import { useState } from 'react'

// メインナビゲーション
const mainNavItems = [
  { icon: LayoutDashboard, label: 'ダッシュボード', href: '/admin' },
  { icon: Users, label: 'ユーザー管理', href: '/admin/users' },
  { icon: FileText, label: 'テンプレート', href: '/admin/templates' },
  { icon: BarChart3, label: '統計', href: '/admin/analytics' },
  { icon: CreditCard, label: '売上', href: '/admin/billing' },
]

// AIツールサブメニュー
const aiToolsItems = [
  { label: '導入事例生成', href: '/admin/case-interview' },
  { label: '営業資料AI', href: '/admin/sales-doc' },
  { label: '文字起こし', href: '/admin/transcription' },
]

// マーケサブメニュー
const marketingItems = [
  { label: 'マーケ支援', href: '/admin/marketing-support' },
  { label: 'コンサル案件', href: '/admin/consulting' },
  { label: 'メール配信', href: '/admin/email' },
  { label: 'バナー管理', href: '/admin/banners' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [openSection, setOpenSection] = useState<string | null>(null)

  const isToolsActive = ['/admin/case-interview', '/admin/sales-doc', '/admin/transcription'].includes(pathname)
  const isMarketingActive = ['/admin/marketing-support', '/admin/consulting', '/admin/email', '/admin/banners'].includes(pathname)

  return (
    <aside className="w-56 bg-gray-900 text-white h-screen sticky top-0 flex flex-col">
      {/* ロゴ */}
      <div className="p-4 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm">DOYA-AI</span>
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
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* AIツール */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={() => setOpenSection(openSection === 'ai' ? null : 'ai')}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all ${
              isToolsActive
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              <span>AIツール</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSection === 'ai' ? 'rotate-180' : ''}`} />
          </button>
          
          {openSection === 'ai' && (
            <div className="mt-1 ml-4 pl-3 border-l border-gray-700 space-y-0.5">
              {aiToolsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-1.5 text-xs rounded transition-colors ${
                    pathname === item.href
                      ? 'text-primary-400 bg-primary-500/10'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* マーケティング */}
        <div className="mt-2">
          <button
            onClick={() => setOpenSection(openSection === 'marketing' ? null : 'marketing')}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all ${
              isMarketingActive
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-4 h-4" />
              <span>マーケティング</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSection === 'marketing' ? 'rotate-180' : ''}`} />
          </button>
          
          {openSection === 'marketing' && (
            <div className="mt-1 ml-4 pl-3 border-l border-gray-700 space-y-0.5">
              {marketingItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-1.5 text-xs rounded transition-colors ${
                    pathname === item.href
                      ? 'text-primary-400 bg-primary-500/10'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 設定 */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <Link
            href="/admin/settings"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              pathname === '/admin/settings'
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>設定</span>
          </Link>
        </div>
      </nav>

      {/* 下部 */}
      <div className="p-3 border-t border-gray-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition-all"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>ユーザー画面</span>
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
