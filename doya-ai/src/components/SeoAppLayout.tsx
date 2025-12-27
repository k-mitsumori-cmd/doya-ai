'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { SeoSidebar } from '@/components/SeoSidebar'

type SeoPlanCode = 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

export function SeoAppLayout({
  children,
  currentPlan,
}: {
  children: React.ReactNode
  currentPlan?: SeoPlanCode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  const planLabel =
    currentPlan === 'PRO'
      ? 'プロ'
      : currentPlan === 'ENTERPRISE'
        ? 'エンタープライズ'
        : currentPlan === 'FREE'
          ? '無料'
          : '不明'

  const planTone =
    currentPlan === 'ENTERPRISE'
      ? 'bg-violet-50 text-violet-700 border-violet-100'
      : currentPlan === 'PRO'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-gray-50 text-gray-600 border-gray-100'

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block">
        <SeoSidebar />
      </div>

      {/* Sidebar - Mobile */}
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
              <SeoSidebar isMobile />
              <button
                className="absolute top-4 right-[-3.5rem] p-2 text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex flex-col min-h-screen transition-all duration-300 ease-in-out md:pl-[240px]">
        {/* Top Header (SEO専用：useSessionを使わず、/api/auth/session 連打を防ぐ) */}
        <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">ドヤ記事作成AI</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">SEOツール</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/pricing" className="hidden sm:block">
              <div className={`h-10 px-4 rounded-xl border text-xs font-black inline-flex items-center ${planTone}`}>
                現在のプラン：{planLabel}
              </div>
            </Link>
            <Link href="/seo/create">
              <button className="h-10 px-4 rounded-xl bg-[#2563EB] text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                新規記事作成
              </button>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}


