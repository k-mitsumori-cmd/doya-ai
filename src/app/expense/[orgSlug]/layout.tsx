'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import AppShell from '@/components/shell/AppShell'
import ToolFrame from '@/components/shell/ToolFrame'
import { expenseNav } from '@/lib/expense/nav'
import { OrgContext, Loading, ErrorBox } from '@/components/expense/ui'
import type { Role } from '@/components/expense/types'

export default function ExpenseOrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const { data: session } = useSession()
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/expense/usage?org=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/expense')
          return
        }
        const d = await r.json()
        if (!alive) return
        if (d?.role) {
          setRole(d.role as Role)
          setState('ok')
        } else setState('denied')
      })
      .catch(() => alive && setState('denied'))
    return () => {
      alive = false
    }
  }, [orgSlug, router])

  return (
    <AppShell userName={session?.user?.name}>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ToolFrame serviceId="expense" nav={expenseNav(orgSlug, role)}>
        {state === 'loading' && <Loading />}
        {state === 'denied' && <ErrorBox forbidden />}
        {state === 'ok' && <OrgContext.Provider value={{ orgSlug, role }}>{children}</OrgContext.Provider>}
      </ToolFrame>
    </AppShell>
  )
}
