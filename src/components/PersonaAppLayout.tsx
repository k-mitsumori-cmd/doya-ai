'use client'

import React, { useState, useEffect } from 'react'
import { PersonaSidebar } from '@/components/PersonaSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

interface PersonaAppLayoutProps {
  children: React.ReactNode
  currentPlan?: 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'
  isLoggedIn?: boolean
  firstLoginAt?: string | null
}

export function PersonaAppLayout({
  children,
  currentPlan = 'GUEST',
  isLoggedIn = false,
  firstLoginAt = null,
}: PersonaAppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <PersonaSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={setIsSidebarCollapsed}
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-purple-600 to-indigo-700 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg">🎯</span>
            </div>
            <div>
              <h1 className="text-sm font-black text-white">ドヤペルソナ</h1>
              <p className="text-[10px] text-purple-100/70 font-bold">ペルソナ＆クリエイティブ生成</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72"
            >
              <PersonaSidebar isMobile forceExpanded />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{
          marginLeft: isSidebarCollapsed ? 72 : 240,
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden lg:block min-h-screen"
      >
        <div className="min-h-screen">
          {children}
        </div>
      </motion.main>

      {/* Mobile Main Content */}
      <main className="lg:hidden pt-16 min-h-screen">
        {children}
      </main>
    </div>
  )
}

