'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sym = (name: string, size = 20) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

export default function ShodanMobileNav({ orgSlug, orgName }: { orgSlug: string; orgName?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
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
    <div className="md:hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <Link href="/shodan" className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow">🎯</span>
          <span className="font-black text-slate-900 text-[15px]">ドヤ商談準備</span>
        </Link>
        <button onClick={() => setOpen(true)} className="text-slate-700 p-1" aria-label="メニューを開く">{sym('menu', 26)}</button>
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-white shadow-xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="leading-tight">
                <div className="font-black text-slate-900">ドヤ商談準備</div>
                <div className="text-[11px] font-bold text-slate-400 truncate max-w-[170px]">{orgName || orgSlug}</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 p-1" aria-label="閉じる">{sym('close', 24)}</button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {items.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-sm transition-colors ${
                    isActive(it.href, it.exact) ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}>
                  {sym(it.icon)}
                  {it.label}
                </Link>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-100">
              <Link href={`${base}/new`} onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-purple-500/25">
                {sym('bolt')}URLから準備する
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
