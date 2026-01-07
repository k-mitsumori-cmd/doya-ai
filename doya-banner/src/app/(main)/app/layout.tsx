'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { 
  Sparkles, Home, Clock, Palette, CreditCard, LogOut, Menu, X, User, Shield,
  Crown, ChevronRight, Zap, HelpCircle, ExternalLink
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const plan = (session?.user as any)?.plan || 'FREE'
  const isAdmin = (session?.user as any)?.role === 'admin'
  const isPro = plan === 'PRO'

  const mainMenuItems = [
    { icon: Home, label: '生成', href: '/app', description: '新しいバナーを作成' },
    { icon: Clock, label: '履歴', href: '/app/history', description: '過去の生成履歴' },
    { icon: Palette, label: 'ブランド', href: '/app/brand', description: 'カラー・ロゴ設定' },
  ]

  const bottomMenuItems = [
    { icon: CreditCard, label: '課金・プラン', href: '/app/billing' },
  ]

  if (isAdmin) {
    bottomMenuItems.push({ icon: Shield, label: '管理画面', href: '/app/admin' })
  }

  const isActive = (href: string) => {
    if (href === '/app') {
      return pathname === '/app'
    }
    return pathname.startsWith(href)
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== モバイルヘッダー ===== */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 h-16 flex items-center px-4">
        <div className="flex items-center justify-between w-full">
          <Link href="/app" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">ドヤバナー</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </header>

      {/* ===== モバイルオーバーレイ ===== */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ===== サイドバー ===== */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 w-72 bg-white h-screen flex flex-col",
          "transform transition-transform duration-300 ease-out",
          "border-r border-gray-100 shadow-xl lg:shadow-none",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ロゴ */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <div className="flex items-center justify-between w-full">
            <Link href="/app" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl text-gray-900">ドヤバナー</span>
                <span className="text-xs text-gray-400 block -mt-0.5">by AI</span>
              </div>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              aria-label="メニューを閉じる"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* プラン表示 */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div
            className={cn(
              "rounded-xl px-4 py-3 transition-all",
              isPro
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                : "bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200"
            )}
          >
            <div className="flex items-center gap-3">
              {isPro ? (
                <Crown className="w-5 h-5" />
              ) : (
                <Zap className="w-5 h-5 text-amber-500" />
              )}
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {isPro ? 'プロプラン' : '無料プラン'}
                </p>
                <p className={cn("text-xs", isPro ? "text-blue-100" : "text-gray-500")}>
                  {isPro ? '無制限に生成可能' : '1日1枚まで無料'}
                </p>
              </div>
              {!isPro && (
                <Link 
                  href="/app/billing"
                  className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center hover:bg-amber-200 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-amber-600" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* メインナビゲーション */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            メニュー
          </p>
          {mainMenuItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-blue-100" : "bg-gray-100"
                  )}>
                    <item.icon className={cn("w-5 h-5", active ? "text-blue-600" : "text-gray-500")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium", active ? "text-blue-600" : "text-gray-900")}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{item.description}</p>
                  </div>
                  {active && (
                    <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
                  )}
                </div>
              </Link>
            )
          })}

          <div className="pt-4 mt-4 border-t border-gray-100">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              設定
            </p>
            {bottomMenuItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm",
                      active
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* ヘルプリンク */}
        <div className="p-4 border-t border-gray-100">
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors text-sm"
          >
            <HelpCircle className="w-5 h-5" />
            <span>ヘルプ・お問い合わせ</span>
            <ExternalLink className="w-4 h-4 ml-auto" />
          </a>
        </div>

        {/* ユーザー情報 */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          {session?.user && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                {session.user.image ? (
                  <img 
                    src={session.user.image} 
                    alt="" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">
                  {session.user.name || 'ユーザー'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session.user.email}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors group"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-600" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ===== メインコンテンツ ===== */}
      <div className="lg:ml-72">
        {/* モバイル用のスペーサー */}
        <div className="h-16 lg:hidden" />
        <main>{children}</main>
      </div>
    </div>
  )
}
