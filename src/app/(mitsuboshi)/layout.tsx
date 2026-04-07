/**
 * 三ツ星アプリ シリーズ共通レイアウト
 *
 * ルートレイアウト (`src/app/layout.tsx`) の下にネストされ、
 * `SessionProvider` / `Toaster` / GTM は継承する。
 * ただしドヤAIのヘッダー・サイドバー・ToolSwitcher は一切 import しない。
 *
 * 配下ルート: `(mitsuboshi)/nagusame/*`, 将来は他Vol.
 */

import type { Metadata, Viewport } from 'next'
import { Noto_Serif_JP, Cormorant_Garamond } from 'next/font/google'
import { MITSUBOSHI_BRAND } from '@/lib/mitsuboshi/_shared/constants'

// 三ツ星アプリ専用フォントを next/font で最適化読み込み。
// display: 'swap' でロード中はシステムフォントで描画し、豆腐化を防ぐ。
// Noto Serif JP は容量が大きいので weight を 400/700 の2種だけに絞ってモバイル帯域を節約。
const notoSerifJp = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-mitsuboshi-jp',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-mitsuboshi-en',
})

// 三ツ星アプリ独自のメタデータ。ルートレイアウトの doya-ai ブランドを完全に上書きし、
// SNS シェア時にも 三ツ星 として認識されるようにする。
export const metadata: Metadata = {
  metadataBase: new URL('https://mitsuboshi.surisuta.jp'),
  title: {
    default: MITSUBOSHI_BRAND.seriesName,
    template: `%s | ${MITSUBOSHI_BRAND.seriesName}`,
  },
  description: MITSUBOSHI_BRAND.tagline,
  applicationName: MITSUBOSHI_BRAND.seriesName,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: MITSUBOSHI_BRAND.seriesName,
    title: MITSUBOSHI_BRAND.seriesName,
    description: MITSUBOSHI_BRAND.tagline,
    url: 'https://mitsuboshi.surisuta.jp',
    locale: 'ja_JP',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: MITSUBOSHI_BRAND.seriesName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: MITSUBOSHI_BRAND.seriesName,
    description: MITSUBOSHI_BRAND.tagline,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: ['ナグサメ', '三ツ星アプリ', '慰め', '愚痴', 'AI', 'メンタルケア', 'コンパニオン'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0B0E24',
}

export default function MitsuboshiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${notoSerifJp.variable} ${cormorant.variable} relative min-h-screen bg-mitsuboshi-midnight font-mitsuboshi text-mitsuboshi-moon`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(35,40,81,0.8) 0%, transparent 55%), radial-gradient(circle at 80% 90%, rgba(22,27,58,0.9) 0%, transparent 60%), linear-gradient(180deg, #0B0E24 0%, #161B3A 100%)',
      }}
    >
      {/* 星屑の微細な装飾 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(rgba(245,243,232,0.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 flex min-h-screen flex-col">
        {children}
      </div>
    </div>
  )
}
