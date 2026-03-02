'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import VoiceSidebar from './VoiceSidebar'

export default function VoiceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as any

  const pageTitle = (() => {
    if (pathname === '/voice') return 'ダッシュボード'
    if (pathname?.startsWith('/voice/new')) return '新規ナレーション'
    if (pathname?.startsWith('/voice/record')) return '録音スタジオ'
    if (pathname?.startsWith('/voice/speakers')) return 'ボイス一覧'
    if (pathname?.startsWith('/voice/history')) return '生成履歴'
    if (pathname?.startsWith('/voice/guide')) return 'ガイド'
    if (pathname?.startsWith('/voice/pricing')) return '料金プラン'
    if (pathname?.startsWith('/voice/settings')) return '設定'
    if (pathname?.startsWith('/voice/')) return 'プロジェクト詳細'
    return 'ドヤボイスAI'
  })()

  return (
    <div className="flex h-screen bg-white">
      {/* サイドバー (デスクトップ) */}
      <div className="hidden md:block">
        <VoiceSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(v) => setSidebarCollapsed(v)}
        />
      </div>
      {/* スペーサー */}
      <div
        className="hidden md:block flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarCollapsed ? 72 : 240 }}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* デスクトップヘッダー */}
        <header className="hidden md:flex h-14 flex-shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 lg:px-8 items-center justify-between z-10">
          <div className="flex items-center gap-4 lg:gap-8 flex-1">
            <h2 className="text-base font-black text-slate-900 whitespace-nowrap">
              {pageTitle}
            </h2>
            <div className="relative w-full max-w-xs lg:max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 placeholder:text-slate-400 transition-all outline-none"
                placeholder="プロジェクトを検索..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/voice/new"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新規生成
            </Link>
            {user?.image ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white cursor-pointer overflow-hidden ring-1 ring-slate-200 flex-shrink-0">
                <img className="w-full h-full object-cover" src={user.image} alt={user.name || ''} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-100 border-2 border-white ring-1 ring-slate-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        </header>

        {/* モバイルヘッダー */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-200">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-600 rounded-md flex items-center justify-center">
              <span className="text-white text-sm">🎙️</span>
            </div>
            <span className="font-bold text-slate-900 text-sm">ドヤボイスAI</span>
          </div>
          <Link
            href="/voice/new"
            className="p-2 rounded-lg bg-violet-600 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Link>
        </header>

        {/* コンテンツ */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      {/* モバイルサイドバーオーバーレイ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <VoiceSidebar
              isMobile
              forceExpanded
              onToggle={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
