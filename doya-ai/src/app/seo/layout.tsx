import type { Metadata } from 'next'
import Link from 'next/link'
import ServiceNav from '@/components/ServiceNav'

export const metadata: Metadata = {
  title: 'ドヤ記事作成',
  description: 'SEO + LLMOに強い長文記事を分割生成で安定作成するツール。',
}

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ポータル
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/seo" className="font-bold text-gray-900">
              ドヤ記事作成
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ServiceNav currentService="seo" />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}


