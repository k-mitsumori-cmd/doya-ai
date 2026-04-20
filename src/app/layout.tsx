import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Providers } from '@/components/Providers'
import { SITE_CONFIG, SERVICE_SEO, generateOrganizationSchema } from '@/lib/seo'
import { GoogleTagManager, GoogleTagManagerNoScript } from '@/components/GoogleTagManager'
import LogoutToastListener from '@/components/LogoutToastListener'

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
        alt: 'ドヤAIポータル - ビジネスを加速するAIツール群',
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
  
  // アイコン
  icons: {
    // App Routerの /icon, /apple-icon を使う（静的ファイル不要）
    icon: [{ url: '/icon', type: 'image/png' }],
    shortcut: [{ url: '/icon', type: 'image/png' }],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
  
  // マニフェスト
  manifest: '/site.webmanifest',
  
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

  return (
    <html lang="ja">
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
        
        {/* Preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Material Symbols Outlined */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>
        {/* Material Symbols フォント読み込み検知 — 読み込み前のテキスト表示防止 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (!document.fonts || !document.fonts.check) {
                  document.body.classList.add('fonts-loaded');
                  return;
                }
                function check() {
                  if (document.fonts.check('1em "Material Symbols Outlined"')) {
                    document.body.classList.add('fonts-loaded');
                  } else {
                    requestAnimationFrame(check);
                  }
                }
                if (document.readyState === 'complete') {
                  check();
                } else {
                  window.addEventListener('load', check);
                }
              })();
            `,
          }}
        />
        {/* Google Tag Manager (noscript) */}
        <GoogleTagManagerNoScript />
        <Providers>
          {children}
          <LogoutToastListener />
          <Toaster
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
