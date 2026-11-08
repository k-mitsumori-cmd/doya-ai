'use client'

import type { ExpenseClaimIssue } from '@/lib/expense/member-admission'

export default function AdmissionNotice({ issues }: { issues: ExpenseClaimIssue[] }) {
  if (!issues.length) return null
  return <section aria-label="招待への参加状況" role="status" className="m-4 space-y-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--ink)]">
    <h2 className="text-base font-semibold">参加を保留している招待があります</h2>
    <ul className="space-y-3">{issues.map((issue, index) => <li key={issue.organizationSlug || index}>
      {issue.organizationName && <p className="font-semibold">{issue.organizationName}</p>}
      <p>{issue.message}</p>
      {issue.action === 'contact-owner' && <p>組織のオーナーに確認を依頼してください。席の追加が必要な場合は、オーナーが手続きします。</p>}
    </li>)}</ul>
    <button type="button" onClick={() => window.location.reload()} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[var(--bg)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">参加状況を再確認する</button>
  </section>
}
