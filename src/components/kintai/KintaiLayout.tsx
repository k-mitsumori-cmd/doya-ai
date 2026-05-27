'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
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
        <style jsx>{`
          @keyframes layoutBearFloat {
            0%, 100% { transform: translateY(0px) rotate(-2deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }
          .layout-bear-float { animation: layoutBearFloat 2.5s ease-in-out infinite; }
        `}</style>
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
        <style jsx>{`
          @keyframes loginBearBounce {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          .login-bear-bounce { animation: loginBearBounce 2.5s ease-in-out infinite; }
        `}</style>
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
    <div className="flex min-h-screen bg-slate-50">
      <KintaiSidebar role={role} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-6 py-3">
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
              <span className="text-sm font-medium text-slate-700 hidden sm:block">{employeeName}</span>
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={employeeName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white text-xs font-bold">
                  {employeeName[0]}
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/kintai' })}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="ログアウト"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
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
    '/kintai/requests': '申請',
    '/kintai/requests/new': '新規申請',
    '/kintai/approvals': '承認',
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
