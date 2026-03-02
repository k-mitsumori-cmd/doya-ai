'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Lock, User, Eye, EyeOff, Sparkles, AlertCircle, Clock, CheckCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import Script from 'next/script'

// Turnstile設定
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
const IS_TURNSTILE_ENABLED = !!TURNSTILE_SITE_KEY

// Turnstileグローバル型定義
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: object) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileError, setTurnstileError] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  // Turnstileウィジェットをレンダリング
  const renderTurnstile = useCallback(() => {
    if (!IS_TURNSTILE_ENABLED || !turnstileRef.current || !window.turnstile) return

    // 既存のウィジェットを削除
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current)
      } catch (e) {
        // ignore
      }
    }

    // 新しいウィジェットをレンダリング
    try {
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          setTurnstileToken(token)
        },
        'expired-callback': () => {
          setTurnstileToken('')
        },
        'error-callback': () => {
          setTurnstileToken('')
          setTurnstileError(true)
          setError('CAPTCHA読み込みエラー。ページを更新してください。')
        },
        theme: 'dark',
        size: 'flexible',
      })
    } catch (e) {
      console.error('Turnstile render error:', e)
    }
  }, [])

  // Turnstileをリセット
  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    if (window.turnstile && widgetIdRef.current) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch (e) {
        // fallback: 再レンダリング
        renderTurnstile()
      }
    }
  }, [renderTurnstile])

  // 既にログインしている場合はダッシュボードにリダイレクト
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/session', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated) {
            router.push('/admin')
          }
        }
      } catch (error) {
        // エラーは無視（未ログイン状態）
      }
    }
    checkSession()
  }, [router])

  // ロックアウトカウントダウン
  useEffect(() => {
    if (!lockoutUntil) return

    const interval = setInterval(() => {
      const now = new Date()
      if (lockoutUntil <= now) {
        setLockoutUntil(null)
        setError('')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lockoutUntil])

  // Turnstile初期化
  useEffect(() => {
    if (turnstileLoaded && IS_TURNSTILE_ENABLED) {
      // 少し遅延させてDOMが準備できるのを待つ
      const timer = setTimeout(() => {
        renderTurnstile()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [turnstileLoaded, renderTurnstile])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setRemainingAttempts(null)
    setLockoutUntil(null)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ identifier, password, turnstileToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          // レート制限エラー
          setError(data.error || 'ログイン試行回数が上限に達しました')
          if (data.lockoutUntil) {
            setLockoutUntil(new Date(data.lockoutUntil))
          }
        } else if (response.status === 401) {
          // 認証失敗
          setError(data.error || 'ユーザー名またはパスワードが正しくありません')
          if (data.remainingAttempts !== undefined) {
            setRemainingAttempts(data.remainingAttempts)
          }
        } else if (data.turnstileError) {
          // CAPTCHA検証エラー
          setError(data.error || 'CAPTCHA検証に失敗しました')
        } else {
          setError(data.error || 'ログインに失敗しました')
        }
        // Turnstileをリセット
        resetTurnstile()
        setIsLoading(false)
        return
      }

      // ログイン成功
      toast.success('管理者としてログインしました')
      router.push('/admin')
      router.refresh()
    } catch (error) {
      console.error('Login error:', error)
      setError('ログイン処理中にエラーが発生しました。再度お試しください。')
      setIsLoading(false)
    }
  }

  const getLockoutMessage = () => {
    if (!lockoutUntil) return null

    const now = new Date()
    const diff = lockoutUntil.getTime() - now.getTime()

    if (diff <= 0) return null

    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    return `${minutes}分${seconds}秒`
  }

  const lockoutMessage = getLockoutMessage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 shadow-lg shadow-primary-500/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">DOYA-AI 管理画面</h1>
          <p className="text-gray-400">管理者アカウントでログインしてください</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400 font-medium">{error}</p>
                    {remainingAttempts !== null && remainingAttempts > 0 && (
                      <p className="text-xs text-red-300 mt-1">
                        残り試行回数: {remainingAttempts}回
                      </p>
                    )}
                    {lockoutMessage && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-red-300">
                        <Clock className="w-3 h-3" />
                        <span>ロックアウト解除まで: {lockoutMessage}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ユーザー名 / メール
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="メールアドレスまたはユーザー名"
                  required
                  disabled={isLoading || !!lockoutMessage}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="••••••••••"
                  required
                  disabled={isLoading || !!lockoutMessage}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  disabled={isLoading || !!lockoutMessage}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile CAPTCHA */}
            {IS_TURNSTILE_ENABLED && (
              <div className="space-y-2">
                {!turnstileError ? (
                  <>
                    <div 
                      ref={turnstileRef}
                      className="flex justify-center min-h-[65px]"
                    />
                    {!turnstileToken && turnstileLoaded && (
                      <div className="flex items-center justify-center gap-2 text-xs text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>CAPTCHAを完了してください</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">CAPTCHA読み込みエラー</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      ページを更新
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !!lockoutMessage || (IS_TURNSTILE_ENABLED && !turnstileToken)}
              className="w-full py-4 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  認証中...
                </>
              ) : lockoutMessage ? (
                <>
                  <Clock className="w-5 h-5" />
                  ロックアウト中...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  ログイン
                </>
              )}
            </button>
          </form>

          {/* セキュリティ情報 */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-300 mb-1">セキュリティ機能</p>
                <ul className="space-y-1 text-gray-400">
                  {IS_TURNSTILE_ENABLED && (
                    <li>• Cloudflare Turnstile（CAPTCHA）</li>
                  )}
                  <li>• ログイン試行回数制限（5回）</li>
                  <li>• IPアドレスベースのレート制限</li>
                  <li>• セキュアなセッション管理</li>
                  <li>• すべてのログイン試行を記録</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Turnstile Script */}
        {IS_TURNSTILE_ENABLED && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="lazyOnload"
            onLoad={() => setTurnstileLoaded(true)}
          />
        )}

        {/* フッター */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2024 DOYA-AI. 管理者専用ページ
        </p>
      </motion.div>
    </div>
  )
}
