import { Metadata } from 'next'
import MovieLayout from '@/components/movie/MovieLayout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ドヤムービーAI — 動画広告を10分で作る',
  description: '商品情報を入力するだけで、AIが動画広告を自動生成。YouTube・TikTok・Instagram対応。',
  openGraph: {
    title: 'ドヤムービーAI — 動画広告を10分で作る',
    description: '商品情報を入力するだけで、AIが動画広告を自動生成。YouTube・TikTok・Instagram対応。',
    url: 'https://doya-ai.surisuta.jp/movie',
    siteName: 'ドヤAI',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ドヤムービーAI — 動画広告を10分で作る',
    description: '商品情報を入力するだけで、AIが動画広告を自動生成。',
  },
  alternates: {
    canonical: 'https://doya-ai.surisuta.jp/movie',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MovieLayout>{children}</MovieLayout>
}
