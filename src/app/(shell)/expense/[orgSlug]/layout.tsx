'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import ToolFrame from '@/components/shell/ToolFrame'
import { expenseNav } from '@/lib/expense/nav'
import { OrgContext, Loading, ErrorBox } from '@/components/expense/ui'
import type { Role } from '@/components/expense/types'

export default function ExpenseOrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const [role, setRole] = useState<Role | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/expense/usage?org=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/expense')
          return
        }
        // ⚠️ 読み込みの失敗（500・通信エラー）を「権限なし」と出さない（システム点検 EXP-F07）
        if (!r.ok) {
          if (alive) setState(r.status === 403 ? 'denied' : 'error')
          return
        }
        const d = await r.json()
        if (!alive) return
        if (d?.role) {
          setRole(d.role as Role)
          setState('ok')
        } else setState('denied')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [orgSlug, router, attempt])

  return (
    // 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビだけ
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ToolFrame serviceId="expense" nav={expenseNav(orgSlug, role)}>
        {state === 'loading' && <Loading />}
        {state === 'denied' && <ErrorBox forbidden />}
        {state === 'error' && <ErrorBox onRetry={() => setAttempt((n) => n + 1)} />}
        {state === 'ok' && <OrgContext.Provider value={{ orgSlug, role }}>{children}</OrgContext.Provider>}
      </ToolFrame>
    </>
  )
}
