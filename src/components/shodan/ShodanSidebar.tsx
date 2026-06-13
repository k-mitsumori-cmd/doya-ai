'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DoyaKun } from '@/components/shodan/ui'

const sym = (name: string) => (
  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{name}</span>
)

export default function ShodanSidebar({ orgSlug, orgName }: { orgSlug: string; orgName?: string }) {
  const pathname = usePathname()
  const base = `/shodan/${encodeURIComponent(orgSlug)}`
  const items = [
    { href: base, icon: 'dashboard', label: '商談準備一覧', exact: true },
    { href: `${base}/new`, icon: 'add_circle', label: '新規作成', exact: false },
    { href: `${base}/settings`, icon: 'business_center', label: '自社情報', exact: false },
    { href: `${base}/members`, icon: 'group', label: 'メンバー', exact: false },
  ]
  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      <Link href="/shodan" className="px-5 py-4 flex items-center gap-2 border-b border-slate-100">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/25">🎯</span>
        <div className="leading-tight">
          <div className="font-black text-slate-900 text-[15px]">ドヤ商談準備</div>
          <div className="text-[11px] font-bold text-slate-400 truncate max-w-[140px]">{orgName || orgSlug}</div>
        </div>
      </Link>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => (
          <Link key={it.href} href={it.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              isActive(it.href, it.exact) ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'
            }`}>
            {sym(it.icon)}
            {it.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 pb-3">
        <div className="relative rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 p-3 pr-16">
          <p className="text-[11px] font-black text-purple-700 leading-snug">URLを入れるだけで<br />商談準備が完成！</p>
          <DoyaKun mood="thumbsup" size={56} className="!absolute -top-3 -right-1" />
        </div>
      </div>

      <div className="p-3 border-t border-slate-100">
        <Link href={`${base}/new`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-purple-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
          {sym('bolt')}URLから準備する
        </Link>
      </div>
    </aside>
  )
}
