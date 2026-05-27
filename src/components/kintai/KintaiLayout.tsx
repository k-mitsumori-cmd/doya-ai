'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import KintaiSidebar from './KintaiSidebar'
import KintaiOnboarding from './KintaiOnboarding'

interface KintaiLayoutProps {
  children: React.ReactNode
}

interface UsageData {
  organizationId: string | null
  employeeId?: string
  role?: string
  employeeName?: string
  plan?: string
}

export default function KintaiLayout({ children }: KintaiLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  const isLandingPage = pathname === '/kintai'
  const isPricingPage = pathname === '/kintai/pricing'
  const isPublicPage = isLandingPage || isPricingPage

  useEffect(() => {
    if (session?.user) {
      fetch('/api/kintai/usage')
        .then((r) => r.json())
        .then((data: UsageData) => {
          if (data.organizationId) {
            setHasOrg(true)
            setUsage(data)
          } else {
            setHasOrg(false)
          }
        })
        .catch(() => setHasOrg(false))
    } else if (status === 'unauthenticated') {
      setHasOrg(false)
    }
  }, [session, status])

  // Public pages render children directly
  if (isPublicPage) {
    return <>{children}</>
  }

  // Loading state
  if (status === 'loading' || (session?.user && hasOrg === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/kintai/characters/thinking_考え中.png"
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
  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-2xl p-12 max-w-md">
          <img
            src="/kintai/characters/hello_挨拶.png"
            alt="挨拶するクマ"
            className="login-bear-bounce mx-auto mb-4"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-[#7f19e6]/20">
            <span className="material-symbols-outlined text-3xl">schedule</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">ドヤ勤怠</h1>
          <p className="text-slate-500 mb-6">ログインして勤怠管理を始めましょう</p>
          <a
            href="/auth/signin?callbackUrl=/kintai/dashboard"
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <KintaiSidebar role={role} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 lg:px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 ml-12 lg:ml-0">
              <span className="material-symbols-outlined text-base text-[#7f19e6]">schedule</span>
              <span className="font-medium text-slate-700">ドヤ勤怠</span>
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
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
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
