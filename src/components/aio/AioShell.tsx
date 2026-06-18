'use client'

// ドヤAIO 自己完結サイドバー＋フレーム（共有サイドバーのテーマ非依存・軽量）
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Menu, LayoutDashboard, ListChecks, Building2, Users, CreditCard, LogOut } from 'lucide-react'

export default function AioShell({ orgSlug, orgName, children }: { orgSlug: string; orgName?: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 768)
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const base = `/aio/${encodeURIComponent(orgSlug)}`
  const NAV = [
    { href: base, label: 'ダッシュボード', icon: LayoutDashboard },
    { href: `${base}/prompts`, label: '監視プロンプト', icon: ListChecks },
    { href: `${base}/settings`, label: 'ブランド設定', icon: Building2 },
    { href: `${base}/members`, label: 'メンバー', icon: Users },
    { href: '/aio/pricing', label: '料金プラン', icon: CreditCard },
  ]
  const isActive = (href: string) => (href === base ? pathname === base : pathname === href || pathname.startsWith(href + '/'))

  const Sidebar = (
    <aside className="w-60 shrink-0 h-full bg-gradient-to-b from-purple-700 to-fuchsia-700 text-white flex flex-col">
      <div className="px-4 py-5 flex items-center gap-2 border-b border-white/15">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/15 text-lg">🔍</span>
        <div className="min-w-0">
          <p className="font-black leading-tight">ドヤAIO</p>
          <p className="text-[11px] text-purple-100 font-bold truncate">{orgName || orgSlug}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV.map((it) => {
          const Icon = it.icon
          return (
            <Link key={it.href} href={it.href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                isActive(it.href) ? 'bg-white text-fuchsia-700 shadow' : 'text-purple-50 hover:bg-white/10'
              }`}>
              <Icon className="w-[18px] h-[18px]" />
              {it.label}
            </Link>
          )
        })}
      </nav>
      <button onClick={() => signOut({ callbackUrl: '/aio' })}
        className="m-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-purple-50 hover:bg-white/10 transition-colors">
        <LogOut className="w-[18px] h-[18px]" />ログアウト
      </button>
    </aside>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="hidden md:flex">{Sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-50">{Sidebar}</div>
        </div>
      )}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-3 p-3 border-b border-slate-200 bg-white sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"><Menu className="w-6 h-6" /></button>
          <span className="font-black text-slate-900">🔍 ドヤAIO</span>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}
