'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

interface DoyalistLayoutProps { children: React.ReactNode }
interface UsageData {
  plan?: { raw?: string; tier?: string; periodEnd?: string | null } | string
}

const NAV_ITEMS: { href: string; icon: string; label: string }[] = [
  { href: '/doyalist', icon: 'auto_awesome', label: 'リスト作成' },
  { href: '/doyalist/tools/form', icon: 'edit_note', label: 'フォーム営業文' },
  { href: '/doyalist/tools/email', icon: 'mail', label: 'メール文面' },
  { href: '/doyalist/tools/phone', icon: 'phone_in_talk', label: '荷電スクリプト' },
  { href: '/doyalist/history', icon: 'history', label: '履歴' },
  { href: '/doyalist/pricing', icon: 'diamond', label: '料金' },
  { href: '/doyalist/settings', icon: 'settings', label: '設定' },
]

export default function DoyalistLayout({ children }: DoyalistLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname() || ''
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (session?.user) {
      fetch('/api/doyalist/usage').then((r) => r.json()).then((data: UsageData) => setUsage(data)).catch(() => setUsage({ plan: 'FREE' }))
    }
  }, [session])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-40 animate-pulse" />
          <p className="text-sm text-slate-400 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    const callback = encodeURIComponent(pathname || '/doyalist')
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-xl p-12 max-w-md">
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-56 mx-auto mb-6" />
          <p className="text-slate-500 mb-6 font-medium">ログインして営業リスト生成を始めましょう</p>
          <a
            href={`/auth/signin?callbackUrl=${callback}`}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0a1530] text-white font-bold rounded-2xl hover:bg-[#13234d] hover:shadow-xl transition-all"
          >
            <span className="material-symbols-outlined">login</span>
            Googleでログイン
          </a>
        </div>
      </div>
    )
  }

  const userName = session.user.name || 'ゲスト'
  const userEmail = session.user.email || ''
  const userImage = session.user.image || ''
  // プラン情報の一本化: usage.plan.tier > session.user.plan > 'FREE'
  const planRaw: any = usage?.plan
  const planTier = (typeof planRaw === 'object' && planRaw !== null ? planRaw.tier || planRaw.raw : planRaw) || (session.user as any)?.plan || 'FREE'
  const plan = String(planTier).toUpperCase()

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-md border border-slate-200"
        aria-label="メニューを開く"
      >
        <span className="material-symbols-outlined text-slate-700">menu</span>
      </button>

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 z-50">
            <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div className="hidden lg:block h-screen sticky top-0">
        <Sidebar pathname={pathname} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 lg:px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500 ml-12 lg:ml-0">
              <img src="/doyalist/logo.png" alt="ドヤリスト" className="h-8 hidden lg:block" />
              <BreadcrumbLabel pathname={pathname} />
            </div>
            <div className="flex items-center gap-3">
              <PlanBadge plan={plan} />
              <UserMenu
                name={userName}
                email={userEmail}
                image={userImage}
                plan={plan}
                onSignOut={() => signOut({ callbackUrl: '/doyalist' })}
              />
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 bg-slate-50">{children}</main>
      </div>
    </div>
  )
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const isActive = (href: string) => {
    if (href === '/doyalist') return pathname === '/doyalist'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full bg-[#0a1530] w-64">
      <div className="p-4 border-b border-white/10">
        <Link href="/doyalist" className="block" onClick={onNavigate}>
          <img src="/doyalist/logo.png" alt="ドヤリスト" className="w-full h-auto" />
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                active
                  ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-[#0a1530] font-bold shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 font-medium hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true" style={active ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 他のドヤAIサービスへ */}
      <div className="px-3 pb-3">
        <ToolSwitcherMenu currentService="doyalist" showLabel={true} isCollapsed={false} />
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-4 text-white shadow-lg shadow-violet-500/30 relative overflow-hidden">
          <img src="/kintai/characters/working_作業中.png" alt="" className="absolute -bottom-2 -right-2 w-16 h-16 opacity-90" />
          <p className="text-[10px] font-bold opacity-90">AIで営業を加速</p>
          <p className="text-sm font-black mt-0.5 leading-snug">あなたの営業を<br/>AIがサポート</p>
          <Link
            href="/doyalist"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold bg-white text-violet-600 hover:bg-cyan-50 transition-colors px-3 py-1.5 rounded-full relative z-10"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            リスト作成
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const label = plan === 'PRO' ? 'プロ' : plan === 'LIGHT' ? 'ライト' : plan === 'ENTERPRISE' ? 'エンタープライズ' : '無料'
  const cls = plan === 'FREE' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cls}`}>{label}プラン</span>
      <Link href="/doyalist/pricing" className="text-xs text-[#0a1530] hover:underline font-medium">プランを見る</Link>
    </div>
  )
}

function BreadcrumbLabel({ pathname }: { pathname: string }) {
  const segments: { match: RegExp | string; label: string }[] = [
    { match: '/doyalist', label: 'リスト作成' },
    { match: '/doyalist/tools/form', label: 'フォーム営業文' },
    { match: '/doyalist/tools/email', label: 'メール文面' },
    { match: '/doyalist/tools/phone', label: '荷電スクリプト' },
    { match: '/doyalist/history', label: '履歴' },
    { match: '/doyalist/pricing', label: '料金プラン' },
    { match: '/doyalist/settings', label: '設定' },
  ]
  const found = [...segments].reverse().find((s) => (typeof s.match === 'string' ? pathname === s.match : s.match.test(pathname)))
  if (!found || found.label === 'リスト作成') return null
  return (
    <>
      <span className="text-slate-300">/</span>
      <span className="text-slate-700 font-medium">{found.label}</span>
    </>
  )
}

function UserMenu({ name, email, image, plan, onSignOut }: { name: string; email: string; image: string; plan: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="ユーザーメニュー"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 p-1.5 pl-2 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer select-none"
      >
        {image ? (
          <img src={image} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 pointer-events-none" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#0a1530] flex items-center justify-center text-white text-sm font-bold pointer-events-none">{name[0]}</div>
        )}
        <span className="text-sm font-bold text-slate-700 hidden sm:block pointer-events-none">{name}</span>
        <span className="material-symbols-outlined text-slate-400 text-lg hidden sm:block pointer-events-none">expand_more</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 py-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">{name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{email}</p>
            <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full">{plan} プラン</span>
          </div>
          <div className="py-1">
            <Link href="/doyalist/pricing" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <span className="material-symbols-outlined text-lg text-cyan-500">diamond</span>料金プラン
            </Link>
            <Link href="/doyalist/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <span className="material-symbols-outlined text-lg text-slate-400">settings</span>設定
            </Link>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button onClick={onSignOut} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50 w-full text-left">
              <span className="material-symbols-outlined text-lg">logout</span>ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
