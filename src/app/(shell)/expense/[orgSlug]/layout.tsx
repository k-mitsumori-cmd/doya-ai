'use client'

import { Fragment, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import ToolFrame from '@/components/shell/ToolFrame'
import { expenseNav } from '@/lib/expense/nav'
import { OrgContext, Loading, ErrorBox } from '@/components/expense/ui'
import { useExpenseQuery } from '@/components/expense/api'
import { EXPENSE_ROLES } from '@/lib/expense/constants'
import type { Role } from '@/components/expense/types'

export default function ExpenseOrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const membership = useExpenseQuery<{ onboarded: boolean; organization: { slug: string } | null; role: unknown }>('/api/expense/usage', orgSlug)
  const { status, scopeKey, isCurrent } = membership
  const role: Role | null = membership.data?.onboarded === true && membership.data.organization?.slug === orgSlug && (EXPENSE_ROLES as readonly unknown[]).includes(membership.data.role)
    ? membership.data.role as Role : null
  const denied = membership.forbidden || !!membership.data && !role && membership.data.organization?.slug === orgSlug

  useEffect(() => {
    if (status === 401 && isCurrent()) router.replace('/expense')
  }, [status, scopeKey, isCurrent, router])

  return (
    // 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビだけ
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ToolFrame serviceId="expense" nav={expenseNav(orgSlug, membership.error ? null : role)}>
        {membership.loading && !membership.data && <Loading />}
        {denied ? <ErrorBox forbidden /> : membership.error || !membership.loading && !role ? <ErrorBox onRetry={membership.reload} /> : null}
        {!membership.error && role && <Fragment key={scopeKey}><OrgContext.Provider value={{ orgSlug, role }}>{children}</OrgContext.Provider></Fragment>}
      </ToolFrame>
    </>
  )
}
