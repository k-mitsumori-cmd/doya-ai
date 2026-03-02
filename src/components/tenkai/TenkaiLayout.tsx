'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import TenkaiSidebar from './TenkaiSidebar'

interface TenkaiLayoutProps {
  children: React.ReactNode
}

export default function TenkaiLayout({ children }: TenkaiLayoutProps) {
  const { data: session } = useSession()
  const [usage, setUsage] = useState({ creditsUsed: 0, creditsTotal: 10 })

  useEffect(() => {
    if (session?.user) {
      fetch('/api/tenkai/usage')
        .then((r) => r.json())
        .then((data) => {
          if (data.usage) {
            setUsage({
              creditsUsed: data.usage.creditsUsed ?? 0,
              creditsTotal: data.usage.creditsLimit ?? data.limits?.monthlyCredits ?? 10,
            })
          }
        })
        .catch(() => {})
    }
  }, [session])

  const plan = session?.user?.plan || 'FREE'
  const planLabel = plan === 'PRO' ? 'Pro' : plan === 'STARTER' ? 'Starter' : plan === 'ENTERPRISE' ? 'Enterprise' : 'Free'

  return (
    <div className="flex min-h-screen bg-slate-50">
      <TenkaiSidebar
        userName={session?.user?.name || 'ゲスト'}
        userImage={session?.user?.image || undefined}
        plan={planLabel}
        creditsUsed={usage.creditsUsed}
        creditsTotal={usage.creditsTotal}
      />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
