import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'ドヤマーケAI — URLを入れるだけで、マーケ課題が全部見える',
  description:
    'サイトのURLを入れるだけで、サイト診断・SEO・ペルソナ・ビジュアル・アクションプランを同時生成するオールインワン・マーケティングAI。',
  openGraph: {
    title: 'ドヤマーケAI',
    description: 'URLを入れるだけで、マーケ課題が全部見える。',
  },
}

export default function AllinoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-allinone-bg text-allinone-ink antialiased">
      <AllinoneHeader />
      <main className="min-h-[calc(100vh-64px)]">{children}</main>
    </div>
  )
}

function AllinoneHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-allinone-line/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/allinone" className="group inline-flex items-center gap-2">
          <div className="relative">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-allinone-primary via-fuchsia-500 to-allinone-cyan text-white shadow-lg shadow-allinone-primary/30 transition-transform group-hover:rotate-[6deg]">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="pointer-events-none absolute inset-0 -z-10 animate-allinone-ping-slow rounded-xl bg-allinone-primary/30" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-black tracking-tight">ドヤマーケAI</span>
            <span className="text-[10px] font-bold tracking-[0.2em] text-allinone-muted">
              ALL-IN-ONE MARKETING
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-bold text-allinone-inkSoft sm:flex">
          <Link href="/allinone" className="rounded-lg px-3 py-2 hover:bg-allinone-surface">
            トップ
          </Link>
          <Link href="/allinone/history" className="rounded-lg px-3 py-2 hover:bg-allinone-surface">
            履歴
          </Link>
          <Link href="/allinone/pricing" className="rounded-lg px-3 py-2 hover:bg-allinone-surface">
            料金
          </Link>
          <Link
            href="/"
            className="ml-2 rounded-lg bg-allinone-surface px-3 py-2 text-allinone-muted hover:text-allinone-ink"
          >
            ドヤAIトップ
          </Link>
        </nav>
      </div>
    </header>
  )
}
