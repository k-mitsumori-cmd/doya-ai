'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Menu, Plus, Timer, X } from 'lucide-react'
import Link from 'next/link'
import { SeoSidebar } from '@/components/SeoSidebar'

type SeoPlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

export function SeoAppLayout({
  children,
  currentPlan,
  isLoggedIn,
  firstLoginAt,
}: {
  children: React.ReactNode
  currentPlan?: SeoPlanCode
  isLoggedIn?: boolean
  firstLoginAt?: string | null
}) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [trialRemainSec, setTrialRemainSec] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isLoggedIn) {
      setTrialRemainSec(null)
      return
    }
    const iso = String(firstLoginAt || '').trim()
    if (!iso) {
      setTrialRemainSec(null)
      return
    }
    const start = Date.parse(iso)
    if (!Number.isFinite(start)) {
      setTrialRemainSec(null)
      return
    }
    const ends = start + 60 * 60 * 1000
    const tick = () => {
      const remain = Math.max(0, Math.floor((ends - Date.now()) / 1000))
      setTrialRemainSec(remain > 0 ? remain : null)
    }
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [isLoggedIn, firstLoginAt])

  const planLabel =
    currentPlan === 'PRO'
      ? 'プロ'
      : currentPlan === 'ENTERPRISE'
        ? 'エンタープライズ'
        : currentPlan === 'GUEST'
          ? 'ゲスト'
        : currentPlan === 'FREE'
          ? '無料'
          : '不明'

  const planTone =
    currentPlan === 'ENTERPRISE'
      ? 'bg-violet-50 text-violet-700 border-violet-100'
      : currentPlan === 'PRO'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : currentPlan === 'GUEST'
          ? 'bg-white/70 text-gray-700 border-gray-200'
        : 'bg-gray-50 text-gray-600 border-gray-100'

  const planHref = isLoggedIn ? '/seo/dashboard/plan' : '/seo/pricing'

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
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
          {/* trial bar */}
          {trialRemainSec != null && (
            <div className="px-4 md:px-8 pt-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-blue-900 truncate">
                      初回ログイン特典：1時間 使い放題（PRO相当）
                    </p>
                    <p className="text-[10px] font-bold text-blue-800/80 truncate">
                      画像生成・AI自動修正などが解放されています
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">残り</p>
                    <p className="text-sm font-black text-blue-900 tabular-nums">
                      {Math.floor(trialRemainSec / 60)}:{String(trialRemainSec % 60).padStart(2, '0')}
                    </p>
                  </div>
                  <div className="w-28 h-2 rounded-full bg-blue-100 overflow-hidden">
                    <div
                      className="h-2 bg-blue-600"
                      style={{ width: `${Math.min(100, Math.max(0, (trialRemainSec / 3600) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="h-16 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">ドヤライティングAI</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">SEOツール</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={planHref} className="hidden sm:block">
              <div className={`h-10 px-4 rounded-xl border text-xs font-black inline-flex items-center ${planTone}`}>
                現在のプラン：{planLabel}
              </div>
            </Link>
            {!isLoggedIn && (
              <Link href="/auth/signin">
                <button className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50 transition-colors inline-flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  ログイン
                </button>
              </Link>
            )}
            <Link href="/seo/create">
              <button className="h-10 px-4 rounded-xl bg-[#2563EB] text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                新規記事作成
              </button>
            </Link>
          </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}






