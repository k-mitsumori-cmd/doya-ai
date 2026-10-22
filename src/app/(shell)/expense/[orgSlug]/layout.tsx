'use client'

import { Fragment } from 'react'
import { useParams } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import ToolFrame from '@/components/shell/ToolFrame'
import SignInReturnLink from '@/components/SignInReturnLink'
import { expenseNav } from '@/lib/expense/nav'
import { OrgContext, Loading, ErrorBox } from '@/components/expense/ui'
import { useExpenseQuery } from '@/components/expense/api'
import { EXPENSE_ROLES } from '@/lib/expense/constants'
import type { Role } from '@/components/expense/types'

export default function ExpenseOrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const membership = useExpenseQuery<{ onboarded: boolean; organization: { slug: string } | null; role: unknown }>('/api/expense/usage', orgSlug)
  const { status, scopeKey } = membership
  const role: Role | null = membership.data?.onboarded === true && membership.data.organization?.slug === orgSlug && (EXPENSE_ROLES as readonly unknown[]).includes(membership.data.role)
    ? membership.data.role as Role : null
  const denied = membership.forbidden || !!membership.data && !role && membership.data.organization?.slug === orgSlug
  // The query's keyed view already excludes old scopes. A synchronous 401 from
  // an unauthenticated SDK render precedes useLayoutEffect activating current().
  const authExpired = status === 401

  return (
    // 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビだけ
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <ToolFrame serviceId="expense" nav={expenseNav(orgSlug, membership.error ? null : role)}>
        {membership.loading && !membership.data && <Loading />}
        {authExpired ? <div role="alert" className="mx-auto max-w-xl space-y-3 p-6 text-sm text-slate-700">
          <p>ログイン状態を確認できませんでした。この組織の作業を続けるには、再度ログインして所属を確認してください。</p>
          <SignInReturnLink fallback={`/expense/${encodeURIComponent(orgSlug)}`} className="inline-block text-blue-700 underline">この画面に戻ってログインする</SignInReturnLink>
          <button type="button" onClick={membership.reload} className="block text-blue-700 underline">所属を再確認する</button>
          <a href="/home" className="inline-block text-blue-700 underline">ホームに戻る</a>
        </div> : denied ? <ErrorBox forbidden /> : membership.error || !membership.loading && !role ? <ErrorBox onRetry={membership.reload} /> : null}
        {!membership.error && role && <Fragment key={scopeKey}><OrgContext.Provider value={{ orgSlug, role }}>{children}</OrgContext.Provider></Fragment>}
      </ToolFrame>
    </>
  )
}
