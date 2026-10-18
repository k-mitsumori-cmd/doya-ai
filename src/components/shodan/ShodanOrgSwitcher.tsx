'use client'

// ============================================
// ドヤ商談準備: 組織の切り替え（共通シェルの ToolFrame の switcher に渡す）
// ============================================
// 組織は URL の slug で決まる。所属組織の一覧は既存の /api/shodan/me から取り、選んだら /shodan/<slug> へ移る（入口と同じ移動先）。
// ⚠️ localStorage・?org=・ヘッダーは使わない。所属が 1 つだけのときは組織名の表示だけにする
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Membership { slug: string; name: string }

export default function ShodanOrgSwitcher({ orgSlug, orgName }: { orgSlug: string; orgName?: string }) {
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/shodan/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.memberships)) setMemberships(d.memberships) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const label = orgName || orgSlug
  if (memberships.length < 2) {
    return <span className="text-[13px] font-semibold text-slate-600" aria-label="組織">{label}</span>
  }
  return (
    <select
      aria-label="組織を切り替える"
      value={orgSlug}
      onChange={(e) => router.push(`/shodan/${encodeURIComponent(e.target.value)}`)}
      className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] font-semibold text-slate-700"
    >
      {memberships.some((m) => m.slug === orgSlug) ? null : <option value={orgSlug}>{label}</option>}
      {memberships.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
    </select>
  )
}
