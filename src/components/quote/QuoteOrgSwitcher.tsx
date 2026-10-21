'use client'

import { useQuoteWorkspace } from './QuoteWorkspaceBoundary'

const ROLE_LABEL: Record<string, string> = { owner: 'オーナー', admin: '管理者', manager: 'マネージャー', member: 'メンバー' }

/** Change the URL scope; storage is only a remembered entry hint. */
export default function QuoteOrgSwitcher() {
  const { scope, switchTo } = useQuoteWorkspace()
  if (scope.kind !== 'ready' || scope.memberships.length <= 1) return null
  return <label className="flex items-center gap-2 text-xs text-slate-500">組織
    <select value={scope.proof.organization.slug} onChange={event => switchTo(event.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#0066ff] focus:outline-none">
      {scope.memberships.map(row => <option key={row.id} value={row.slug}>{row.name}（{ROLE_LABEL[row.role]}）</option>)}
    </select>
  </label>
}
