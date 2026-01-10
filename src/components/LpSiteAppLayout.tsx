'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LpSiteSidebar } from './LpSiteSidebar'
import { Menu, X } from 'lucide-react'

export function LpSiteAppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  React.useEffect(() => {
    const saved = localStorage.getItem('lp-site-sidebar-collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  const handleToggle = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
    localStorage.setItem('lp-site-sidebar-collapsed', String(collapsed))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <LpSiteSidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[240px] shadow-2xl"
            >
              <LpSiteSidebar forceExpanded isMobile />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[240px]'
      }`}>
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b">
          <div className="flex items-center justify-between h-full px-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}



