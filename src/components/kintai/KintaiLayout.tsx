'use client'

import { useSession, signOut } from 'next-auth/react'
import { useCallback, useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { readBillingResponse } from '@/lib/billing-response-client'
import Link from 'next/link'
import KintaiSidebar from './KintaiSidebar'
import KintaiOnboarding from './KintaiOnboarding'
import { KintaiAccessContext } from './KintaiAccessContext'

interface KintaiLayoutProps {
  children: React.ReactNode
}

interface UsageData {
  organizationId: string | null
  employeeId?: string
  role?: string
  isActive?: boolean
  employeeName?: string
  plan?: string
}

export default function KintaiLayout({ children }: KintaiLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  // SessionProvider.update temporarily retains its previous data while loading.
  const isSessionLoading = status === 'loading'
  const isSignedOut = status === 'unauthenticated'
  const [usage, setUsage] = useState<UsageData | null>(null)
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

  const isLandingPage = pathname === '/kintai'
  const isPricingPage = pathname === '/kintai/pricing'
  const isInvitePage = pathname?.startsWith('/kintai/invite')
  const isPublicPage = isLandingPage || isPricingPage || isInvitePage

  const loadUsage = useCallback(async (preserveView = false) => {
    if (!activeScope.current.allowed || activeScope.current.key !== scopeKey) return
    pendingUsage.current?.abort()
    const controller = new AbortController()
    pendingUsage.current = controller
    const request = ++usageRequest.current
    const current = () => !controller.signal.aborted && request === usageRequest.current && activeScope.current.allowed && activeScope.current.key === scopeKey
    if (!preserveView) {
      setHasOrg(null)
      setUsage(null)
      setUsageError(false)
    }
    try {
      await Promise.resolve()
      if (!current()) return
      const response = await readBillingResponse('/api/kintai/usage', { method: 'GET' }, controller.signal)
      if (!current()) return
      if (!response.ok) throw new Error('利用状況を確認できませんでした')
      const data = response.data as unknown as UsageData
      if (data.organizationId !== null && (typeof data.organizationId !== 'string' || !data.organizationId)) throw new Error('利用状況の応答が不正です')
      if (data.organizationId && (typeof data.isActive !== 'boolean' || typeof data.plan !== 'string' || typeof data.role !== 'string')) throw new Error('従業員の状態を確認できませんでした')
      setUsage(data.organizationId ? data : null)
      setHasOrg(Boolean(data.organizationId))
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
      setUsage(null)
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

  // Public pages render children directly
  if (isPublicPage) {
    return <>{children}</>
  }

  if (status === 'authenticated' && !actor) return <div role="alert" className="p-6 text-center">ログイン情報を確認できません。<a href="/auth/signin" className="ml-2 underline">再度ログインする</a></div>

  if (usageError && session?.user && !knownScope) {
    return <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center"><p className="font-bold text-rose-700">勤怠情報を取得できませんでした。組織の状態は変更されていません。</p><button type="button" onClick={() => void loadUsage()} className="rounded-xl bg-[#7f19e6] px-5 py-3 font-bold text-white">再読み込み</button></div>
  }

  // Loading state
  if (!knownScope && (isSessionLoading || (session?.user && hasOrg === null) || allowed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/kintai/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png"
            alt="読み込み中"
            className="layout-bear-float"
            style={{ width: 100, height: 100, objectFit: 'contain' }}
          />
          <div className="w-10 h-10 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
          <p className="text-sm text-slate-400 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  // Not authenticated → redirect to landing page
  if (!session?.user || isSignedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-2xl p-12 max-w-md">
          <img
            src="/kintai/characters/hello_%E6%8C%A8%E6%8B%B6.png"
            alt="挨拶するクマ"
            className="login-bear-bounce mx-auto mb-4"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-[#7f19e6]/20">
            <img src="/kintai/logo.png" alt="ドヤ勤怠" style={{ height: 48, objectFit: 'contain' }} />
          </div>
          
          <p className="text-slate-500 mb-6">ログインして勤怠管理を始めましょう</p>
          <a
            href="/auth/signin?callbackUrl=/kintai/clock"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#7f19e6]/20 transition-all"
          >
            <span className="material-symbols-outlined">login</span>
            ログイン
          </a>
        </div>
      </div>
    )
  }

  // No organization → show onboarding
  if (!hasOrg) {
    return <KintaiOnboarding />
  }

  const role = usage?.role || 'employee'
  const employeeName = usage?.employeeName || session?.user?.name || 'ゲスト'

  return (
    <>
      {isSessionLoading && <div role="status" className="p-6 text-center">認証情報を確認しています。</div>}
      {usageError && <div role="alert" className="bg-amber-50 p-3 text-center text-sm">勤怠情報を再確認できませんでした。入力内容は保持しています。<button type="button" onClick={() => void loadUsage(true)} className="ml-2 underline">再取得する</button></div>}
    <KintaiAccessContext.Provider value={{ isActive: usage?.isActive ?? null }}>
    <div ref={element => { if (element) element.inert = isSessionLoading || usageError }} style={isSessionLoading ? { display: 'none' } : undefined} className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <KintaiSidebar role={role} employeeActive={usage?.isActive !== false} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 lg:px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 ml-12 lg:ml-0">
              <img src="/kintai/logo.png" alt="ドヤ勤怠" className="h-6 object-contain" />
              
              <BreadcrumbLabel pathname={pathname} />
            </div>
            {/* Plan badge + User area */}
            <div className="flex items-center gap-3">
              <PlanBadge plan={usage?.plan} />
              <UserMenu
                name={employeeName}
                email={session?.user?.email || ''}
                image={session?.user?.image || ''}
                plan={usage?.plan || 'FREE'}
                onSignOut={() => signOut({ callbackUrl: '/kintai' })}
              />
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0">
          {usage?.isActive === false && (
            <div role="status" className="mx-4 mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-6">
              従業員情報が無効化されています。勤怠と申請の履歴は閲覧できますが、打刻や申請の操作はできません。管理者にご確認ください。
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
    </KintaiAccessContext.Provider>
    </>
  )
}

function PlanBadge({ plan }: { plan?: string }) {
  const p = (plan || 'FREE').toUpperCase()
  let label: string
  let badgeClass: string

  switch (p) {
    case 'ENTERPRISE':
      label = 'エンタープライズ'
      badgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
      break
    case 'PRO':
      label = 'プロ'
      badgeClass = 'bg-purple-50 text-purple-700 border-purple-200'
      break
    case 'LIGHT':
    case 'STARTER':
      label = 'スターター'
      badgeClass = 'bg-violet-50 text-violet-700 border-violet-200'
      break
    default:
      label = '無料プラン'
      badgeClass = 'bg-gray-50 text-gray-600 border-gray-200'
  }

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
        {label}
      </span>
      <Link
        href="/kintai/pricing"
        className="text-xs text-[#7f19e6] hover:text-[#5b0fb3] font-medium hover:underline transition-colors"
      >
        プランを見る
      </Link>
    </div>
  )
}

function BreadcrumbLabel({ pathname }: { pathname: string }) {
  const segments: Record<string, string> = {
    '/kintai/dashboard': 'マイページ',
    '/kintai/clock': '打刻',
    '/kintai/attendance': '勤怠一覧',
    '/kintai/requests': 'マイ申請',
    '/kintai/requests/new': '新規申請',
    '/kintai/approvals': '承認管理',
    '/kintai/admin/attendance': '部署勤怠',
    '/kintai/employees': '従業員管理',
    '/kintai/departments': '部署管理',
    '/kintai/settings': '就業ルール',
    '/kintai/pricing': '料金プラン',
  }

  const label = segments[pathname]
  if (!label) return null

  return (
    <>
      <span className="text-slate-300">/</span>
      <span className="text-slate-600">{label}</span>
    </>
  )
}

function UserMenu({ name, email, image, plan, onSignOut }: { name: string; email: string; image: string; plan: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors">
        {image ? (
          <img src={image} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white text-sm font-bold ring-2 ring-purple-200">
            {name[0]}
          </div>
        )}
        <span className="text-sm font-bold text-slate-700 hidden sm:block">{name}</span>
        <span className="material-symbols-outlined text-slate-400 text-lg hidden sm:block">expand_more</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 py-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-black text-slate-800">{name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{email}</p>
            <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">{plan.toUpperCase()} プラン</span>
          </div>
          <div className="py-1">
            <Link href="/kintai/pricing" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-lg text-amber-500">diamond</span>
              料金プラン
            </Link>
            <Link href="/kintai/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-lg text-slate-400">settings</span>
              設定
            </Link>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button onClick={onSignOut} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors w-full text-left">
              <span className="material-symbols-outlined text-lg">logout</span>
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
