'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, PenLine, Palette, Sparkles } from 'lucide-react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      {/* subtle bg */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.14),transparent_45%),radial-gradient(circle_at_82%_28%,rgba(99,102,241,0.14),transparent_45%),radial-gradient(circle_at_44%_92%,rgba(15,23,42,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(248,250,252,0.92),rgba(248,250,252,0.92))]" />
      </div>

      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] grid grid-cols-1 lg:grid-cols-2">
        {/* LEFT: animated story */}
        <div className="order-2 lg:order-1 relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 text-white p-8 sm:p-10 lg:p-12">
          <motion.div
            className="absolute -top-28 -left-28 w-80 h-80 rounded-full bg-blue-500/25 blur-3xl"
            animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-indigo-500/25 blur-3xl"
            animate={{ x: [0, -24, 0], y: [0, -16, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-black tracking-wide">
              <Sparkles className="w-4 h-4 text-blue-300" />
              ドヤマーケAI
            </div>

            <h2 className="mt-5 text-2xl sm:text-3xl font-black tracking-tight">
              マーケティング全体を
              <span className="text-blue-300"> AIで一気通貫 </span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/80 font-bold leading-relaxed">
              ドヤバナーAIとドヤライティングAIで、企画→制作→改善までを最短で。
              <br className="hidden sm:block" />
              「作るだけ」で終わらない、成果につなげる制作体験へ。
            </p>

            <div className="mt-8 grid gap-3">
              {[
                { icon: Palette, title: 'ドヤバナーAI', desc: '広告バナーを最速で量産（A/Bテストに強い）', tone: 'from-emerald-500/20 to-blue-500/20' },
                { icon: PenLine, title: 'ドヤライティングAI', desc: 'SEO記事を安定生成（分割生成・監査で品質担保）', tone: 'from-violet-500/20 to-indigo-500/20' },
                { icon: BarChart3, title: '改善まで支援', desc: '訴求・コピー・構成を改善して成果に寄せる', tone: 'from-amber-500/20 to-fuchsia-500/20' },
              ].map((item, idx) => (
                <motion.div
                  key={item.title}
                  className={`rounded-2xl border border-white/15 bg-gradient-to-br ${item.tone} backdrop-blur px-4 py-4 flex items-start gap-3`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut', delay: 0.06 * idx }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black">{item.title}</p>
                    <p className="mt-1 text-xs text-white/75 font-bold leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: form */}
        <div className="order-1 lg:order-2 p-7 sm:p-10 lg:p-12 flex flex-col min-h-[70vh] lg:min-h-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black text-slate-400 tracking-widest uppercase">Sign in</p>
              <h1 className="mt-2 text-2xl font-black text-slate-900">おかえりなさい</h1>
              <p className="mt-2 text-sm text-slate-600 font-bold">Googleアカウントで簡単にログインできます</p>
            </div>
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 px-4 py-3">
              <p className="text-xs font-black">エラー</p>
              <p className="text-sm font-bold mt-1">{errorMessage}</p>
            </div>
          )}

          <div className="mt-6 flex-1 flex flex-col">
            <div className="flex-1 flex items-center">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full max-w-md mx-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors px-5 py-4 font-black text-slate-800 disabled:opacity-70 min-h-[56px]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span className="text-base">{isLoading ? 'ログイン中...' : 'Googleでログイン'}</span>
              </button>
            </div>

            <div className="pt-6 flex items-center justify-between gap-3 flex-wrap">
              <Link href="/seo" className="text-sm font-black text-blue-600 hover:text-blue-700">
                ログインせずに試す →
              </Link>
              <div className="text-xs text-slate-500 font-bold">
                <a href="/terms" className="text-blue-600 hover:underline">利用規約</a>
                <span className="mx-1">/</span>
                <a href="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</a>
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
