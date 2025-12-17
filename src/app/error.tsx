'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Home, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 本番環境ではエラーを外部サービスに送信することも可能
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* アイコン */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-orange-500 mb-6 shadow-xl">
          <AlertTriangle className="w-10 h-10 text-white" />
        </div>
        
        {/* エラーメッセージ */}
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
          エラーが発生しました
        </h1>
        
        <p className="text-gray-600 mb-8">
          ページの読み込み中にエラーが発生しました。<br />
          しばらくしてからもう一度お試しください。
        </p>
        
        {/* アクション */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            再試行する
          </button>
          
          <Link href="/">
            <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full transition-colors">
              <Home className="w-5 h-5" />
              トップへ戻る
            </button>
          </Link>
        </div>
        
        {/* エラー詳細（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-10 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
            <p className="text-sm font-bold text-red-700 mb-2">デバッグ情報:</p>
            <p className="text-xs text-red-600 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}
        
        {/* サポート情報 */}
        <div className="mt-10 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            問題が解決しない場合は
            <a href="mailto:support@doya-ai.com" className="text-violet-600 hover:underline mx-1">
              サポート
            </a>
            までお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  )
}

