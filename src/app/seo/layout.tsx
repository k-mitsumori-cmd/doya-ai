import type { Metadata } from 'next'
import Link from 'next/link'
import ServiceNav from '@/components/ServiceNav'

export const metadata: Metadata = {
  title: 'ドヤ記事作成',
  description: 'SEO + LLMOに強い長文記事を分割生成で安定作成するツール。',
}

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      {/* Spotifyっぽい“没入感”の背景 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-40 -right-24 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-white/60 hover:text-white/85 transition-colors">
              ポータル
            </Link>
            <span className="text-white/20">/</span>
            <Link href="/seo" className="font-extrabold text-white tracking-tight">
              ドヤ記事作成
            </Link>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 font-bold">
              SEO Studio
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">
              料金
            </Link>
            <ServiceNav currentService="seo" />
          </div>
        </div>
      </header>

      <div className="relative">{children}</div>
    </div>
  )
}


