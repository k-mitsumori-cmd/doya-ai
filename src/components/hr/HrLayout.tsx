'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import HrSidebar from './HrSidebar'
import HrOnboarding from './HrOnboarding'

interface HrLayoutProps {
  children: React.ReactNode
}

export default function HrLayout({ children }: HrLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [usage, setUsage] = useState({ employeeCount: 0, employeeLimit: 5 })
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  const isLandingPage = pathname === '/hr'
  const isPricingPage = pathname === '/hr/pricing'
  const isPublicPage = isLandingPage || isPricingPage

  useEffect(() => {
    if (session?.user) {
      fetch('/api/hr/usage')
        .then((r) => {
          if (!r.ok) throw new Error('usage fetch failed')
          return r.json()
        })
        .then((data) => {
          if (data.organizationId) {
            setHasOrg(true)
            setUsage({
              employeeCount: data.employeeCount ?? 0,
              employeeLimit: data.employeeLimit ?? 5,
            })
          } else {
            setHasOrg(false)
          }
        })
        .catch(() => setHasOrg(false))
    } else if (status === 'unauthenticated') {
      setHasOrg(false)
    }
  }, [session, status])

  if (isPublicPage) {
    return <>{children}</>
  }

  if (status === 'loading' || hasOrg === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-xl p-12 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-sky-500/20">
            <span className="material-symbols-outlined text-3xl">groups</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">ドヤHR</h1>
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

  const plan = String((session?.user as any)?.plan || 'FREE').toUpperCase()
  const planLabel =
    plan === 'PRO'
      ? 'Pro'
      : plan === 'STARTER'
        ? 'Starter'
        : plan === 'ENTERPRISE'
          ? 'Enterprise'
          : 'Free'

  return (
    <div className="flex min-h-screen bg-slate-50">
      <HrSidebar
        userName={session?.user?.name || 'ゲスト'}
        userImage={session?.user?.image || undefined}
        plan={planLabel}
        employeeCount={usage.employeeCount}
        employeeLimit={usage.employeeLimit}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
