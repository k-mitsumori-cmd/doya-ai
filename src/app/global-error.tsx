'use client'

// ルートレイアウト自体で例外が起きたときの最後の受け皿。
// これが無いと Next.js 既定の英語画面になるため、日本語で再試行と案内だけを出す。
// layout.tsx の外側で描画されるので、html / body を自前で持ち、共通コンポーネントやCSSに頼らない。
import { useEffect } from 'react'
import Link from 'next/link'
import { reportBrowserError } from '@/components/RuntimeErrorReporter'
import ErrorReportForm from '@/components/common/ErrorReportForm'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportBrowserError('render')
  }, [error])

  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#ffffff', color: '#111827', fontFamily: 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px' }}>エラーが発生しました</h1>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: '#4b5563', margin: '0 0 24px' }}>
              ページを表示できませんでした。お手数ですが、もう一度お試しください。
              <br />
              解決しない場合は、時間をおいて再度アクセスしてください。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{ padding: '12px 24px', borderRadius: 9999, border: 'none', background: '#7c3aed', color: '#ffffff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
              >
                再試行する
              </button>
              <Link
                href="/"
                style={{ padding: '12px 24px', borderRadius: 9999, background: '#f3f4f6', color: '#374151', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
              >
                トップへ戻る
              </Link>
            </div>
            {error?.digest ? (
              <p style={{ marginTop: 24, fontSize: 12, color: '#9ca3af' }}>エラーID: {error.digest}</p>
            ) : null}
            <ErrorReportForm errorType="500" />
          </div>
        </main>
      </body>
    </html>
  )
}
