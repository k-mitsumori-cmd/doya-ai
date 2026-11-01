'use client'

// ============================================
// 営業管理: 組織（ワークスペース）の切り替え（共通の枠の switcher 用）
// ============================================
// 旧来のサイドバーにあった切り替えと同じ仕組み: 所属組織の一覧から選び、/sfa/<slug> へ移る。
// 組織は URL の slug が正本。localStorage・?org=・ヘッダーはここでは扱わない。
// ⚠️ slug は useParams() から URL エンコードされたまま届くので normalizeOrgSlug を通して比べる（2026-10-18 の修正を消さない）。
import { useState } from 'react'
import Link from 'next/link'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { normalizeOrgSlug } from '@/lib/sfa/nav'
import type { SfaShellMembership } from '@/lib/sfa/shell-context'

export default function SfaOrgSwitcher({ orgSlug, memberships }: { orgSlug: string; memberships: SfaShellMembership[] }) {
  const [open, setOpen] = useState(false)
  if (memberships.length === 0) return null
  const current = normalizeOrgSlug(orgSlug)
  const currentWs = memberships.find((m) => normalizeOrgSlug(m.slug) === current)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[16rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-sm font-bold text-slate-800 hover:bg-slate-50"
      >
        <Building2 className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{currentWs?.name || 'ワークスペース'}</span>
        <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-100 bg-white py-1 shadow-xl">
            <p className="px-3 py-1.5 text-[10px] font-black text-slate-400">ワークスペース</p>
            {memberships.map((m) => (
              <Link
                key={m.slug}
                href={`/sfa/${m.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-lime-600 text-[11px] font-black text-white">
                  {m.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-700">{m.name}</span>
                {normalizeOrgSlug(m.slug) === current && <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden />}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
