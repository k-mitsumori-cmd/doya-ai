'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { readBillingResponse } from '@/lib/billing-response-client'
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
  // SessionProvider.update temporarily retains its previous data while loading.
  const isSessionLoading = status === 'loading'
  const isSignedOut = status === 'unauthenticated'
  const [usage, setUsage] = useState({ employeeCount: 0, employeeLimit: 5, plan: 'FREE', canManageEmployees: false })
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)
  const [usageError, setUsageError] = useState(false)
  const usageRequest = useRef(0)
  const actor = status === 'unauthenticated' ? '' : session?.user?.id || ''
  const globalPlan = (session?.user as { plan?: string } | undefined)?.plan
  const allowed = status === 'authenticated' && Boolean(actor)
  const epoch = useRef({ actor, version: 0 })
  if (epoch.current.actor !== actor) epoch.current = { actor, version: epoch.current.version + 1 }
  const scopeKey = JSON.stringify([actor, epoch.current.version])
  const activeScope = useRef({ key: scopeKey, allowed })
  activeScope.current = { key: scopeKey, allowed }
  const [loadedScope, setLoadedScope] = useState('')
  const confirmedScope = useRef(loadedScope)
  confirmedScope.current = loadedScope
  const pendingUsage = useRef<AbortController | null>(null)
  const knownScope = Boolean(actor) && loadedScope === scopeKey
  const previousPathname = useRef(pathname)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLandingPage = pathname === '/hr'
  const isPricingPage = pathname === '/hr/pricing'
  const isPublicPage = isLandingPage || isPricingPage

  const loadUsage = useCallback(async (preserveView = false) => {
    if (!activeScope.current.allowed || activeScope.current.key !== scopeKey) return
    pendingUsage.current?.abort()
    const controller = new AbortController()
    pendingUsage.current = controller
    const request = ++usageRequest.current
    const current = () => !controller.signal.aborted && request === usageRequest.current && activeScope.current.allowed && activeScope.current.key === scopeKey
    if (!preserveView) {
      setHasOrg(null)
      setUsageError(false)
    }
    try {
      await Promise.resolve()
      if (!current()) return
      const response = await readBillingResponse('/api/hr/usage', { method: 'GET' }, controller.signal)
      if (!current()) return
      if (response.status === 401) {
        setHasOrg(false)
        setUsageError(false)
        setLoadedScope(scopeKey)
        return
      }
      if (!response.ok) throw new Error('使用状況を取得できませんでした')
      const data = response.data
      if (typeof data.organizationId !== 'string' || !data.organizationId || typeof data.plan !== 'string' ||
        !Number.isSafeInteger(data.employeeCount) || (data.employeeCount as number) < 0 ||
        !Number.isSafeInteger(data.employeeLimit) || (data.employeeLimit as number) < -1 ||
        typeof data.canManageEmployees !== 'boolean') throw new Error('使用状況の応答が不正です')
      setUsage({ employeeCount: data.employeeCount as number, employeeLimit: data.employeeLimit as number,
        plan: data.plan, canManageEmployees: data.canManageEmployees })
      setHasOrg(true)
      setUsageError(false)
      setLoadedScope(scopeKey)
    } catch {
      if (current()) setUsageError(true)
    } finally {
      if (pendingUsage.current === controller) pendingUsage.current = null
      controller.abort()
    }
  }, [scopeKey])

  useEffect(() => {
    const requestCounter = usageRequest
    if (allowed) void loadUsage(confirmedScope.current === scopeKey)
    else if (status === 'unauthenticated') {
      requestCounter.current++
      setUsageError(false)
      setHasOrg(false)
    }
    return () => { requestCounter.current++; pendingUsage.current?.abort() }
  }, [allowed, actor, status, globalPlan, scopeKey, loadUsage])

  useEffect(() => {
    if (!allowed) return
    const refresh = () => { void loadUsage(confirmedScope.current === scopeKey) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [allowed, scopeKey, loadUsage])

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    if (allowed) void loadUsage(confirmedScope.current === scopeKey)
  }, [pathname, allowed, scopeKey, loadUsage])

  // ルートを変えたらモバイルメニューを閉じる
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  if (isPublicPage) {
    return <>{children}</>
  }

  if (status === 'authenticated' && !actor) return <div role="alert" className="p-6 text-center">ログイン情報を確認できません。<a href="/auth/signin" className="ml-2 underline">再度ログインする</a></div>

  if (usageError && session?.user && !knownScope) {
    return <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center"><p className="font-bold text-rose-700">組織情報を取得できませんでした。組織の状態は変更されていません。</p><button type="button" onClick={() => void loadUsage()} className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white">再読み込み</button></div>
  }

  if (!knownScope && (isSessionLoading || (session?.user && hasOrg === null) || allowed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user || isSignedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-xl p-12 max-w-md">
          <img src="/hr/logo.png" alt="ドヤHR" className="w-56 mx-auto mb-6 drop-shadow" />
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

  if ((pathname === '/hr/employees/new' || /^\/hr\/employees\/[^/]+\/edit$/.test(pathname || '')) && !usage.canManageEmployees) {
    return <div role="alert" className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center font-bold text-slate-700">従業員の登録・編集は管理者のみ利用できます。</div>
  }

  return (
    <>
      {isSessionLoading && <div role="status" className="p-6 text-center">認証情報を確認しています。</div>}
      {usageError && <div role="alert" className="bg-amber-50 p-3 text-center text-sm">組織情報を再確認できませんでした。入力内容は保持しています。<button type="button" onClick={() => void loadUsage(true)} className="ml-2 underline">再取得する</button></div>}
    <div ref={element => { if (element) element.inert = isSessionLoading || usageError }} style={isSessionLoading ? { display: 'none' } : undefined} className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar (fixed / 画面外フロー) */}
      <div className="hidden md:flex">
        <HrSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={(collapsed) => setSidebarCollapsed(collapsed)}
          employeeCount={usage.employeeCount}
          employeeLimit={usage.employeeLimit}
          plan={usage.plan}
          canManageEmployees={usage.canManageEmployees}
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
              plan={usage.plan}
              canManageEmployees={usage.canManageEmployees}
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
    </>
  )
}
