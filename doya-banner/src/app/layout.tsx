import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'ドヤバナー | ワンボタンでプロ品質バナー自動生成',
  description: 'ドヤバナーは、AIを活用してワンボタンでプロ品質のバナーを自動生成するサービスです。通信・マーケティング向けテンプレートで、SNS広告やLP用バナーを簡単に作成。',
  keywords: ['バナー', 'AI', '自動生成', '広告', 'マーケティング', 'デザイン'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
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

