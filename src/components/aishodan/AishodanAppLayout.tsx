'use client'

// ドヤAI商談 アプリ枠（AioAppLayout と同型：デスクトップ/モバイルでサイドバーを配置）
// ⚠️ reference/06-ui-patterns.md §7・§9.2 が正本。独自のヘッダーを作らないこと。
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isGuestPath } from '@/lib/ui/guest-path'
import { Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AishodanSidebar from './AishodanSidebar'

export default function AishodanAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // ⚠️ 第三者が開く画面ではアプリ枠を出さない（社内のサービス一覧を見せない）。
  //    ログイン済みでも面接URLや招待URLを開くことがあるので、セッションだけで判定しない。
  const guest = isGuestPath(pathname)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (guest) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <AishodanSidebar isCollapsed={sidebarCollapsed} onToggle={(c) => setSidebarCollapsed(c)} />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 z-50 md:hidden"
          >
            <AishodanSidebar forceExpanded isMobile onToggle={() => setMobileMenuOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main
        className="flex flex-1 flex-col overflow-hidden transition-all duration-200"
        style={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 72 : 240 }}
      >
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white p-3 md:hidden">
          <button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 text-[18px] text-white shadow">
              forum
            </span>
            <span className="text-base font-black text-slate-900">ドヤAI商談</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
