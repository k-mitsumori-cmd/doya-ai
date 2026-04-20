'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import InterviewSidebar from './InterviewSidebar'

export default function InterviewLayout({
  children,
  currentPlan,
  isLoggedIn,
}: {
  children: React.ReactNode
  currentPlan: string
  isLoggedIn: boolean
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as any

  return (
    <div className="flex h-screen bg-[#f5f7fb]">
      {/* サイドバー (デスクトップ) — fixed position */}
      <div className="hidden md:block">
        <InterviewSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(v) => setSidebarCollapsed(v)}
        />
      </div>
      {/* Spacer for fixed sidebar */}
      <div
        className="hidden md:block flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarCollapsed ? 72 : 240 }}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* デスクトップ トップナビバー */}
        <header className="hidden md:flex h-14 flex-shrink-0 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 lg:px-8 items-center justify-between z-10">
          <div className="flex items-center gap-4 lg:gap-8 flex-1">
            {/* ページタイトル */}
            <h2 className="text-base font-black text-slate-900 whitespace-nowrap">
              {pathname === '/interview' ? '記事作成' :
               pathname?.startsWith('/interview/templates') ? 'テンプレート' :
               pathname?.startsWith('/interview/projects') ? '記事一覧' :
               pathname?.startsWith('/interview/skills') ? 'スキル' :
               pathname?.startsWith('/interview/settings') ? '設定' :
               '記事作成'}
            </h2>
            {/* 検索バー */}
            <div className="relative w-full max-w-xs lg:max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] placeholder:text-slate-400 transition-all outline-none"
                placeholder="プロジェクトを検索..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative" title="通知">
              <span className="material-symbols-outlined text-slate-500 text-xl">notifications</span>
            </button>
            {user?.image ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white cursor-pointer overflow-hidden ring-1 ring-slate-200 flex-shrink-0">
                <img className="w-full h-full object-cover" src={user.image} alt={user.name || ''} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white ring-1 ring-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#7f19e6] text-base">person</span>
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
            <span className="material-symbols-outlined text-slate-700">menu</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#7f19e6] rounded-md flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">mic</span>
            </div>
            <span className="font-bold text-slate-900 text-sm">ドヤインタビューAI</span>
          </div>
          <Link
            href="/interview/projects/new"
            className="p-2 rounded-lg bg-[#7f19e6] text-white"
          >
            <span className="material-symbols-outlined text-lg">add</span>
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
            <InterviewSidebar
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
