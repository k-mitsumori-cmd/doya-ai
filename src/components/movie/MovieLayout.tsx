'use client'
// ============================================
// ドヤムービーAI - レイアウト
// ============================================
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import MovieSidebar from './MovieSidebar'

export default function MovieLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-slate-950">
      {/* サイドバー (デスクトップ) */}
      <div className="hidden md:block">
        <MovieSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(v) => setSidebarCollapsed(v)}
        />
      </div>
      <div
        className="hidden md:block flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarCollapsed ? 72 : 240 }}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* モバイルヘッダー */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-slate-950 border-b border-rose-900/30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-white text-sm">ドヤムービーAI</span>
          <div className="w-9" />
        </header>

        {/* コンテンツ */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
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

      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
        }}
      />

      {/* モバイルサイドバーオーバーレイ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <MovieSidebar
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
