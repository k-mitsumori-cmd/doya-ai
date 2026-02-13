'use client'

import { useState, useEffect } from 'react'
import ShindanSidebar from './ShindanSidebar'
import { Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ShindanAppLayoutProps {
  children: React.ReactNode
}

export default function ShindanAppLayout({ children }: ShindanAppLayoutProps) {
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
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <ShindanSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(collapsed) => setSidebarCollapsed(collapsed)}
        />
      </div>

      {/* Mobile Menu Overlay */}
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
            <ShindanSidebar
              forceExpanded
              isMobile
              onToggle={() => setMobileMenuOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col overflow-hidden transition-all duration-200"
        style={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? 72 : 240 }}
      >
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-4 p-4 border-b border-slate-800 bg-gradient-to-r from-teal-900/50 to-slate-900">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="text-lg font-bold text-white">ドヤ診断AI</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
