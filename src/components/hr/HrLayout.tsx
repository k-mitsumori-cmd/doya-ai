'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Users2 } from 'lucide-react'
import HrSidebar from './HrSidebar'
import HrOnboarding from './HrOnboarding'

interface HrLayoutProps {
  children: React.ReactNode
}

export default function HrLayout({ children }: HrLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [usage, setUsage] = useState({ employeeCount: 0, employeeLimit: 5 })
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLandingPage = pathname === '/hr'
  const isPricingPage = pathname === '/hr/pricing'
  const isPublicPage = isLandingPage || isPricingPage

  useEffect(() => {
    if (session?.user) {
      fetch('/api/hr/usage')
        .then((r) => {
          if (!r.ok) throw new Error('usage fetch failed')
          return r.json()
        })
        .then((data) => {
          if (data.organizationId) {
            setHasOrg(true)
            setUsage({
              employeeCount: data.employeeCount ?? 0,
              employeeLimit: data.employeeLimit ?? 5,
            })
          } else {
            setHasOrg(false)
          }
        })
        .catch(() => setHasOrg(false))
    } else if (status === 'unauthenticated') {
      setHasOrg(false)
    }
  }, [session, status])

  // ルートを変えたらモバイルメニューを閉じる
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  if (isPublicPage) {
    return <>{children}</>
  }

  if (status === 'loading' || hasOrg === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-xl p-12 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-sky-500/20">
            <span className="material-symbols-outlined text-3xl">groups</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">ドヤHR</h1>
          <p className="text-slate-500 mb-6">ログインしてタレントマネジメントを始めましょう</p>
          <a
            href="/auth/signin?callbackUrl=/hr/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
          >
            <span className="material-symbols-outlined">login</span>
            ログイン
          </a>
        </div>
      </div>
    )
  }

  if (!hasOrg) {
    return <HrOnboarding />
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar (fixed / 画面外フロー) */}
      <div className="hidden md:flex">
        <HrSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(collapsed) => setSidebarCollapsed(collapsed)}
          employeeCount={usage.employeeCount}
          employeeLimit={usage.employeeLimit}
        />
      </div>
      {/* デスクトップ用スペーサー: fixed サイドバー幅をCSSのみで確保（JSブレークポイント不要） */}
      <div
        className="hidden md:block flex-shrink-0 transition-[width] duration-200"
        style={{ width: sidebarCollapsed ? 72 : 240 }}
        aria-hidden
      />

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
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 z-50 md:hidden"
          >
            <HrSidebar
              forceExpanded
              isMobile
              onToggle={() => setMobileMenuOpen(false)}
              employeeCount={usage.employeeCount}
              employeeLimit={usage.employeeLimit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-3 p-3 sm:p-4 border-b border-slate-200 bg-white">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="メニューを開く"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-blue-600" />
            <span className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">ドヤHR</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
