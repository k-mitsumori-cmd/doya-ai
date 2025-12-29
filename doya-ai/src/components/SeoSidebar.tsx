'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Plus, Sparkles, HelpCircle, Settings, CreditCard } from 'lucide-react'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

const SEO_NAV: NavItem[] = [
  // 「ダッシュボード」と「生成履歴」は /seo に統合（生成記事一覧）
  { href: '/seo/create', label: '新規記事作成', icon: Plus },
  { href: '/seo/new', label: '新規記事作成（詳細）', icon: Settings },
  { href: '/seo', label: '生成記事一覧', icon: FileText },
  { href: '/seo/settings', label: '設定', icon: Settings },
  { href: '/seo/pricing', label: '料金/プラン', icon: CreditCard },
]

export function SeoSidebar({
  isMobile,
}: {
  isMobile?: boolean
}) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/seo') return pathname === '/seo'
    return pathname.startsWith(href)
  }

  return (
    <aside className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen w-[240px] bg-[#2563EB] flex flex-col z-50 shadow-xl`}>
      <div className="px-6 py-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="overflow-hidden">
          <h1 className="text-2xl font-black text-white tracking-tighter leading-none">ドヤ記事作成AI</h1>
          <p className="text-[10px] font-bold text-blue-100/70 mt-1">SEO最適化・分割生成</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {SEO_NAV.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-blue-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-blue-200/70'}`} />
                <span className="text-sm font-semibold whitespace-nowrap overflow-hidden">{item.label}</span>
                {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/5 bg-blue-700/30">
        <div className="rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10 p-4">
          <p className="text-xs font-black text-white mb-1">ワンショット生成</p>
          <p className="text-[10px] font-bold text-blue-100/80 leading-relaxed">
            タイトルとキーワードだけでOK。本文＋図解＋サムネまで一括生成します。
          </p>
          <Link href="/seo/create">
            <button className="mt-3 w-full py-2 bg-white text-[#2563EB] text-[10px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
              新規記事作成へ
            </button>
          </Link>
          <a
            href={SUPPORT_CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 bg-white/10 text-white text-[10px] font-black rounded-lg hover:bg-white/15 transition-colors border border-white/10"
            title="お問い合わせ（改善点・不具合）"
          >
            <HelpCircle className="w-4 h-4" />
            お問い合わせ
          </a>
        </div>
      </div>
    </aside>
  )
}


