'use client'

// ドヤAIO アプリ枠（ShodanAppLayout と同型：デスクトップ/モバイルでサイドバーを配置）
import { useState, useEffect } from 'react'
import AioSidebar from './AioSidebar'
import { Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AioAppLayout({ orgSlug, orgName, children }: { orgSlug: string; orgName?: string; children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <AioSidebar orgSlug={orgSlug} orgName={orgName} isCollapsed={sidebarCollapsed} onToggle={(c) => setSidebarCollapsed(c)} />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 z-50 md:hidden">
            <AioSidebar orgSlug={orgSlug} orgName={orgName} forceExpanded isMobile onToggle={() => setMobileMenuOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden transition-all duration-200" style={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 72 : 240 }}>
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 p-3 border-b border-slate-200 bg-white sticky top-0 z-30">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"><Menu className="w-6 h-6" /></button>
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white text-sm shadow">🔍</span>
            <span className="text-base font-black text-slate-900">ドヤAIO</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
