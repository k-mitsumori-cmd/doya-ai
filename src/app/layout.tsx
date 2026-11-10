import RuntimeErrorReporter from '@/components/RuntimeErrorReporter';
import MaterialSymbolsReady from '@/components/MaterialSymbolsReady';
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Providers } from '@/components/Providers'
import ClearArtifactsOnSignOut from '@/components/notice/ClearArtifactsOnSignOut'
import FeedbackMount from '@/components/feedback/FeedbackMount'
import { SITE_CONFIG, SERVICE_SEO, generateOrganizationSchema, generateWebSiteSchema } from '@/lib/seo'
import { GoogleTagManager, GoogleTagManagerNoScript } from '@/components/GoogleTagManager'
import { UserStateSignal } from '@/components/UserStateSignal'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import LogoutToastListener from '@/components/LogoutToastListener'
import StripeSuccessSync from '@/components/StripeSuccessSync'
import ServicePopupGuard from '@/components/ServicePopupGuard'
import { getRunningServices } from '@/lib/services'
import { isBrandRenamed } from '@/lib/brand'

// 開発中のベータ版（一覧から外したツール）も、ツールの画面としてポップアップを出さない
const ACTIVE_SERVICE_PATHS = getRunningServices().map(service => service.href)

// ============================================
// ルートメタデータ（ポータル全体）
// ============================================
export const metadata: Metadata = {
  // 基本情報
  title: {
    default: SERVICE_SEO.portal.title,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SERVICE_SEO.portal.description,
  keywords: SERVICE_SEO.portal.keywords,
  
  // サイト情報
  metadataBase: new URL(SITE_CONFIG.url),
  alternates: {
    canonical: '/',
  },
  
  // OGP（Open Graph Protocol）
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    title: SERVICE_SEO.portal.title,
    description: SERVICE_SEO.portal.description,
    images: [
      {
        url: SERVICE_SEO.portal.ogImage,
        width: 1200,
        height: 630,
        alt: 'ドヤAI - AI SaaSサービス群',
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    site: SITE_CONFIG.twitter,
    creator: SITE_CONFIG.twitter,
    title: SERVICE_SEO.portal.title,
    description: SERVICE_SEO.portal.description,
    images: [SERVICE_SEO.portal.ogImage],
  },
  
  // その他
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // アイコン（旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときだけ、ドヤバディの新ロゴ。旗が off の間は今のアイコンのまま）
  // ファイル規約の icon.png / apple-icon.png は旗で出し分けられないため、public/brand/ に移して、ここで明示する。
  icons: isBrandRenamed()
    ? {
        icon: [
          { url: '/brand/doya-buddy/favicon/favicon.ico', sizes: 'any' },
          { url: '/brand/doya-buddy/favicon/favicon.svg', type: 'image/svg+xml' },
          { url: '/brand/doya-buddy/favicon/favicon-32.png', sizes: '32x32', type: 'image/png' },
        ],
        shortcut: [{ url: '/brand/doya-buddy/favicon/favicon.ico' }],
        apple: [{ url: '/brand/doya-buddy/icon/doya-buddy-icon-180.png', sizes: '180x180', type: 'image/png' }],
      }
    : {
        icon: [{ url: '/brand/doya-ai-icon.png', type: 'image/png' }],
        shortcut: [{ url: '/brand/doya-ai-icon.png', type: 'image/png' }],
        apple: [{ url: '/brand/doya-ai-apple-icon.png', type: 'image/png' }],
      },

  // マニフェスト（旗が all のときは、名前とアイコンを新ロゴにしたもの）
  manifest: isBrandRenamed() ? '/site-buddy.webmanifest' : '/site.webmanifest',

  // 認証
  verification: {
    // google: 'your-google-verification-code',
  },
  
  // カテゴリ
  category: 'technology',
}

// ビューポート設定
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 構造化データ
  const organizationSchema = generateOrganizationSchema()
  // サイト名（検索結果に出る名称）の確定用。表記ゆれは alternateName で吸収する
  const webSiteSchema = generateWebSiteSchema()

  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <head>
        {/* Google Tag Manager */}
        <GoogleTagManager />
        
        {/* 構造化データ（JSON-LD） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webSiteSchema),
          }}
        />

        {/* Preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Material Symbols Outlined */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body>
        <MaterialSymbolsReady />
        {/* Google Tag Manager (noscript) */}
        <GoogleTagManagerNoScript />
        <Providers>
          <ServicePopupGuard servicePaths={ACTIVE_SERVICE_PATHS} />
          <RuntimeErrorReporter />{children}
          {/* 改善点・要望をうかがうカード。無料プランの方に、
              1 / 5 / 20回目の利用でだけ右下に出る（判定は lib/feedback.ts） */}
          <FeedbackMount />
          {/* GA4（ドヤマーケと同一プロパティ）: PV・登録・検証済み契約イベント */}
          <GoogleAnalytics />
          {/* ログイン状態を dataLayer に流す。GTM側で「ログイン済みには
              HubSpotのポップアップを出さない」除外条件を書くために必要 */}
          <UserStateSignal />
          <LogoutToastListener />
          {/* ログアウトしたら、最近作った物の記録を消す（どのログアウトの道すじでも。src/components/notice/ClearArtifactsOnSignOut.tsx） */}
          <ClearArtifactsOnSignOut />
          {/* Stripe決済からの戻りを全サービス共通で検知してプランを即時反映（Webhook不達の保険） */}
          <StripeSuccessSync />
          {/* containerClassName: ドヤくんの知らせ（旗 GUIDE_POPUPS_ROLLOUT）が出ている画面では、この Toaster を隠して同じトーストを知らせの見た目で出す（src/components/notice/HotToastBridge.tsx） */}
          <Toaster
            containerClassName="doya-hot-toaster"
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#333',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                padding: '16px',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
