'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Home,
  Sparkles,
  Clock,
  LogOut,
  Menu,
  X,
  User,
  Settings,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { TOOLS } from '@/lib/tools'

// モバイルヘッダーコンポーネント（高さ60px固定）
export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-[60px] flex items-center px-4">
      <div className="flex items-center justify-between w-full">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base text-gray-800">カンタンドヤAI</span>
        </Link>
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="メニューを開く"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
      </div>
    </header>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // パス変更時にモバイルメニューを閉じる
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // モバイルメニューが開いているときはスクロールを無効化
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  const activeTools = TOOLS.filter(tool => !tool.comingSoon)

  return (
    <>
      {/* モバイルヘッダー */}
      <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} />

      {/* モバイルオーバーレイ */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside className={`
        fixed top-0 left-0 z-50
        w-64 bg-white border-r border-gray-200 h-screen flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* ロゴ */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          <div className="flex items-center justify-between w-full">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-800">カンタンドヤAI</span>
            </Link>
            
            {/* モバイル閉じるボタン */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="メニューを閉じる"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* ホーム */}
          <Link href="/dashboard">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-base font-medium ${
                isActive('/dashboard') && pathname === '/dashboard'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>ホーム</span>
            </div>
          </Link>

          {/* ツール一覧 */}
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
              ツール
            </p>
          </div>
          
          {activeTools.map((tool) => (
            <Link key={tool.id} href={tool.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-base font-medium ${
                  isActive(tool.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{tool.icon}</span>
                <span className="flex-1">{tool.name}</span>
                {tool.isNew && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                    NEW
                  </span>
                )}
              </div>
            </Link>
          ))}

          {/* その他 */}
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
              その他
            </p>
          </div>
          
          <Link href="/dashboard/history">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-base font-medium ${
                isActive('/dashboard/history')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>作成履歴</span>
            </div>
          </Link>

          <Link href="/admin">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-base font-medium ${
                isActive('/admin')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>管理画面</span>
            </div>
          </Link>
        </nav>

        {/* プレミアムバナー */}
        {session?.user && (session?.user as any)?.plan !== 'PREMIUM' && (
          <div className="p-3 border-t border-gray-100">
            <Link href="/pricing">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-3 text-center hover:opacity-90 transition-opacity">
                <p className="font-bold text-sm">✨ プレミアムにアップグレード</p>
                <p className="text-xs opacity-80">全ツール無制限で利用可能</p>
              </div>
            </Link>
          </div>
        )}

        {/* ユーザー情報 */}
        <div className="p-3 border-t border-gray-100">
          {session?.user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate text-sm">
                    {session.user.name || 'ユーザー'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          ) : (
            <Link href="/auth/signin">
              <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-colors">
                ログイン
              </button>
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
