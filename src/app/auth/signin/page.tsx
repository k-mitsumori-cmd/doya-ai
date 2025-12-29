'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// エラーコードに対応するメッセージ
const errorMessages: Record<string, string> = {
  'Configuration': 'サーバー設定に問題があります。',
  // NextAuthはプロバイダ初期化に失敗すると error=<providerId> を返すことがある
  // 例: Google OAuthの clientId / clientSecret が未設定
  'google': 'Googleログイン設定が未完了です（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET）。運用環境の環境変数を確認してください。',
  'AccessDenied': 'アクセスが拒否されました。',
  'OAuthSignin': 'ログインを開始できませんでした。',
  'OAuthCallback': 'ログイン処理に失敗しました。',
  'OAuthCreateAccount': 'アカウントの作成に失敗しました。',
  'OAuthAccountNotLinked': 'このメールは別の方法で登録されています。',
  'Default': 'ログインに失敗しました。もう一度お試しください。',
}

function SignInContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get('callbackUrl') || '/seo'
  const error = searchParams.get('error')
  const [isLoading, setIsLoading] = useState(false)

  const errorMessage = error ? (errorMessages[error] || errorMessages['Default']) : null

  const shouldUseBannerLogin = useMemo(() => {
    const raw = String(callbackUrl || '').trim()
    if (!raw) return false
    try {
      // callbackUrl がフルURLで渡るケース
      if (raw.startsWith('http')) {
        const u = new URL(raw)
        if (u.pathname.startsWith('/banner')) return true
      }
    } catch {}
    // callbackUrl がパスで渡るケース
    if (raw.startsWith('/banner')) return true
    if (raw.includes('/banner')) return true
    return false
  }, [callbackUrl])

  useEffect(() => {
    // バナー側ログイン失敗時に /auth/signin に飛んできてしまうケースを救済
    // （NextAuthの pages.error が共通のため）
    if (typeof window === 'undefined') return
    const ref = String(document.referrer || '')
    const fromBanner = ref.includes('/banner') || ref.includes('/auth/doyamarke/signin')
    if (shouldUseBannerLogin || fromBanner) {
      const qs = new URLSearchParams()
      if (callbackUrl) qs.set('callbackUrl', callbackUrl)
      if (error) qs.set('error', error)
      router.replace(`/auth/doyamarke/signin?${qs.toString()}`)
    }
  }, [router, shouldUseBannerLogin, callbackUrl, error])

  if (typeof window !== 'undefined') {
    const ref = String(document.referrer || '')
    const fromBanner = ref.includes('/banner') || ref.includes('/auth/doyamarke/signin')
    if (shouldUseBannerLogin || fromBanner) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600">ログイン画面へ移動中...</p>
          </div>
        </div>
      )
    }
  }

  const handleGoogleLogin = () => {
    setIsLoading(true)
    signIn('google', { callbackUrl })
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">ドヤマーケAI</h1>
          <p className="text-lg text-gray-600">マーケティングのAIならお任せ</p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700">
            <p className="font-bold mb-1">⚠️ エラー</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        {/* ログインボタン */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-bold px-6 py-4 rounded-xl transition-all min-h-[60px] disabled:opacity-70"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span className="text-lg">
            {isLoading ? 'ログイン中...' : 'Googleでログイン'}
          </span>
        </button>

        {/* 説明 */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Googleアカウントで簡単にログインできます
          </p>
        </div>

        {/* ログインせずに使う */}
        <div className="mt-6 text-center">
          <Link 
            href="/seo" 
            className="text-blue-600 hover:underline text-base"
          >
            ログインせずに試す →
          </Link>
        </div>

        {/* 利用規約 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            ログインすると
            <a href="/terms" className="text-blue-600 hover:underline mx-1">利用規約</a>
            と
            <a href="/privacy" className="text-blue-600 hover:underline mx-1">プライバシーポリシー</a>
            に同意したことになります
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}
