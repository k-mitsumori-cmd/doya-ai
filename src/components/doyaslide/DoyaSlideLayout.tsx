'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

const NAV = [
  { href: '/doyaslide', label: 'プロジェクト', icon: 'dashboard', exact: true },
  { href: '/doyaslide/new', label: '新規作成', icon: 'add_circle', exact: false },
  { href: '/doyaslide/pricing', label: '料金プラン', icon: 'workspace_premium', exact: false },
]

export default function DoyaSlideLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Toaster position="top-center" />
      <aside className="hidden md:flex w-60 flex-col bg-gradient-to-b from-fuchsia-600 via-purple-700 to-purple-900 text-white p-4 sticky top-0 h-screen">
        <Link href="/doyaslide" className="flex items-center gap-2 px-2 py-3 mb-4">
          <span className="text-2xl">🖼️</span>
          <div>
            <div className="font-black text-lg leading-none">ドヤスライド</div>
            <div className="text-[10px] text-fuchsia-200/80 font-bold mt-1">全スライドAI画像生成</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  active ? 'bg-white/20 text-white' : 'text-fuchsia-100/70 hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{n.icon}</span>
                {n.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto pt-4">
          {/* 他サービスへの切り替え（統一プランの回遊） */}
          <ToolSwitcherMenu currentService="doyaslide" showLabel isCollapsed={false} />
          <a
            href={SUPPORT_CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-fuchsia-100/70 hover:bg-white/10 text-sm font-bold transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
            お問い合わせ
          </a>
          <div className="px-2 py-3 text-[10px] text-fuchsia-200/40 font-bold">
            ドヤAI / DoyaSlide（開発中）
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  )
}
