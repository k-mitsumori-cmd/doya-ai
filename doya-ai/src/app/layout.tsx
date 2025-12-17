import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'カンタンドヤAI | 文章作成がカンタンになる',
  description: 'テンプレートを選んで情報を入れるだけ。AIが文章を作ります。ビジネスメール、SNS投稿、キャッチコピーなど68種類のテンプレート。',
  keywords: ['AI', '文章作成', 'テンプレート', 'ビジネスメール', 'SNS投稿', 'キャッチコピー', 'ブログ記事'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          {children}
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

