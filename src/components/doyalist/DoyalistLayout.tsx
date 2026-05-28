'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface DoyalistLayoutProps {
  children: React.ReactNode
}

interface UsageData {
  plan?: string
  usage?: {
    creditsUsed?: number
    creditsLimit?: number
    totalProjects?: number
  }
  limits?: {
    monthlyCredits?: number
    isPro?: boolean
  }
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
      fetch('/api/doyalist/usage')
        .then((r) => r.json())
        .then((data: UsageData) => setUsage(data))
        .catch(() => setUsage({ plan: 'FREE' }))
    }
  }, [session])

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-violet-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
          <p className="text-sm text-slate-400 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!session?.user) {
    const callback = encodeURIComponent(pathname || '/doyalist')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-violet-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-2xl p-12 max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-[#7f19e6]/30">
            <span className="material-symbols-outlined" style={{ fontSize: 44 }}>list_alt</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">ドヤリスト</h1>
          <p className="text-slate-500 mb-6">ログインして営業リスト生成を始めましょう</p>
          <a
            href={`/auth/signin?callbackUrl=${callback}`}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#7f19e6]/30 transition-all"
          >
            <span className="material-symbols-outlined">login</span>
            ログイン
          </a>
        </div>
      </div>
    )
  }

  const userName = session.user.name || 'ゲスト'
  const userEmail = session.user.email || ''
  const userImage = session.user.image || ''
  const plan = String((usage?.plan as any) || (session.user as any)?.plan || 'FREE').toUpperCase()

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
        aria-label="メニューを開く"
      >
        <span className="material-symbols-outlined text-slate-600">menu</span>
      </button>

      {/* Mobile overlay + sidebar */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-0 bottom-0 z-50">
            <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">
        <Sidebar pathname={pathname} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 lg:px-6 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500 ml-12 lg:ml-0">
              <span
                className="material-symbols-outlined text-[#7f19e6]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                list_alt
              </span>
              <span className="font-black text-slate-800">ドヤリスト</span>
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

        <main className="flex-1 min-w-0">{children}</main>
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
    <div className="flex flex-col h-full bg-gray-50 w-64 border-r border-slate-100">
      {/* Logo */}
      <div className="p-5 mb-1">
        <Link href="/doyalist" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white shadow-md shadow-[#7f19e6]/20">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}
            >
              list_alt
            </span>
          </div>
          <div>
            <p className="text-base font-black text-slate-800 leading-tight">ドヤリスト</p>
            <p className="text-[10px] font-bold text-slate-400">営業リスト生成AI</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-base transition-all ${
                active
                  ? 'bg-purple-100 text-[#7f19e6] font-black shadow-sm'
                  : 'text-slate-600 font-bold hover:bg-slate-100'
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                aria-hidden="true"
                style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom CTA */}
      <div className="p-4 border-t border-slate-100">
        <div className="rounded-2xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] p-4 text-white shadow-lg shadow-[#7f19e6]/20">
          <p className="text-xs font-bold opacity-80">AIで営業を加速</p>
          <p className="text-sm font-black mt-0.5 leading-snug">AIで企業リスト・営業文を自動生成</p>
          <Link
            href="/doyalist"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-full"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            リスト作成へ
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  let label = '無料プラン'
  let badgeClass = 'bg-gray-50 text-gray-600 border-gray-200'

  switch (plan) {
    case 'ENTERPRISE':
      label = 'エンタープライズ'
      badgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
      break
    case 'PRO':
      label = 'プロ'
      badgeClass = 'bg-purple-50 text-purple-700 border-purple-200'
      break
    case 'LIGHT':
    case 'STARTER':
      label = 'ライト'
      badgeClass = 'bg-violet-50 text-violet-700 border-violet-200'
      break
  }

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badgeClass}`}>
        {label}
      </span>
      <Link
        href="/doyalist/pricing"
        className="text-xs text-[#7f19e6] hover:text-[#5b0fb3] font-medium hover:underline transition-colors"
      >
        プランを見る
      </Link>
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

  // Match from most-specific to least-specific
  const found = [...segments]
    .reverse()
    .find((s) => (typeof s.match === 'string' ? pathname === s.match : s.match.test(pathname)))

  if (!found || found.label === 'リスト作成') return null

  return (
    <>
      <span className="text-slate-300">/</span>
      <span className="text-slate-600 font-bold hidden sm:inline">{found.label}</span>
    </>
  )
}

function UserMenu({
  name,
  email,
  image,
  plan,
  onSignOut,
}: {
  name: string
  email: string
  image: string
  plan: string
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="ユーザーメニューを開く"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
      >
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white text-sm font-bold ring-2 ring-purple-200">
            {name[0]}
          </div>
        )}
        <span className="text-sm font-bold text-slate-700 hidden sm:block">{name}</span>
        <span className="material-symbols-outlined text-slate-400 text-lg hidden sm:block">
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 py-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-black text-slate-800">{name}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{email}</p>
            <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
              {plan} プラン
            </span>
          </div>
          <div className="py-1">
            <Link
              href="/doyalist/pricing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg text-amber-500">diamond</span>
              料金プラン
            </Link>
            <Link
              href="/doyalist/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg text-slate-400">settings</span>
              設定
            </Link>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button
              onClick={onSignOut}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors w-full text-left"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
