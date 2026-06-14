'use client'

import { useState, useEffect } from 'react'
import AdBannerSidebar from './AdBannerSidebar'
import { Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdBannerAppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 768)
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f)
  }, [])
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="hidden md:flex">
        <AdBannerSidebar isCollapsed={collapsed} onToggle={(c) => setCollapsed(c)} />
      </div>
      <AnimatePresence>
        {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ duration: 0.2 }} className="fixed inset-y-0 left-0 z-50 md:hidden">
            <AdBannerSidebar forceExpanded isMobile onToggle={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <main className="flex-1 flex flex-col overflow-hidden transition-all duration-200" style={{ marginLeft: isMobile ? 0 : collapsed ? 72 : 240 }}>
        <div className="md:hidden flex items-center gap-3 p-3 border-b border-slate-200 bg-white sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"><Menu className="w-6 h-6" /></button>
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-orange-500 text-white text-sm shadow">📣</span>
            <span className="text-base font-black text-slate-900">ドヤ広告バナーAI</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
