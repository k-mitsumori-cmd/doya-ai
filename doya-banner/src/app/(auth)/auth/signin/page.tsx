'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Suspense, useState } from 'react'
import Link from 'next/link'

const errorMessages: Record<string, string> = {
  Configuration: 'サーバー設定に問題があります。',
  AccessDenied: 'アクセスが拒否されました。',
  OAuthSignin: 'Google認証の開始に失敗しました。',
  OAuthCallback: 'Google認証の処理に失敗しました。',
  OAuthCreateAccount: 'アカウントの作成に失敗しました。',
  Default: 'ログインに失敗しました。',
}

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/app'
  const error = searchParams.get('error')
  const [isLoading, setIsLoading] = useState(false)

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : null

  const handleGoogleLogin = () => {
    setIsLoading(true)
    signIn('google', { callbackUrl })
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* 左側: ビジュアル */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-8">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            ワンボタンで<br />プロ品質バナー
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            AIがA/B/Cの3案を自動生成。<br />
            デザイナー不要で広告運用を加速。
          </p>

          <div className="space-y-4">
            {[
              '✨ 1日1枚無料で生成',
              '📱 通信・マーケ・EC向けテンプレート',
              '🎯 CTR/CV/認知別に最適化',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white">
                <span className="text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右側: ログインフォーム */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* モバイルロゴ */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ドヤバナー</h1>
            <p className="text-gray-600 mt-1">ワンボタンでプロ品質バナー</p>
          </div>

          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">ログイン / 新規登録</h2>
            <p className="text-gray-600 text-center mb-8">Googleアカウントで始めましょう</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                ⚠️ {errorMessage}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-70"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="font-semibold text-gray-700">
                {isLoading ? 'ログイン中...' : 'Googleでログイン'}
              </span>
            </button>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>
                ログインすると
                <Link href="/terms" className="text-blue-600 hover:underline mx-1">
                  利用規約
                </Link>
                と
                <Link href="/privacy" className="text-blue-600 hover:underline mx-1">
                  プライバシーポリシー
                </Link>
                に同意したことになります
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-center text-sm text-gray-500 mb-3">無料で始められます</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  1日1枚無料
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  A/B/C 3案生成
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  履歴保存
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}

