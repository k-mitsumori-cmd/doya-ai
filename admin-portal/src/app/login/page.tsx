'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      toast.error('パスワードを入力してください')
      return
    }
    
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        toast.error(data.error || 'ログインに失敗しました')
        return
      }
      
      toast.success('ログインしました')
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 p-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-xl shadow-blue-500/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            管理ポータル
          </h1>
          <p className="text-blue-200">
            ドヤシリーズ統合管理画面
          </p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-2">
                管理者パスワード
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-blue-300/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
              ログイン
            </button>
          </form>
        </div>

        {/* サービス一覧 */}
        <div className="mt-8 text-center">
          <p className="text-blue-200/60 text-sm mb-4">管理対象サービス</p>
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-blue-200 text-sm">カンタンドヤAI</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <span className="text-lg">🎨</span>
              <span className="text-purple-200 text-sm">ドヤバナーAI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

