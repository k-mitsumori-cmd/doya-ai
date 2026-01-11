'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, ArrowRight, Loader2, Crown, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'
import Link from 'next/link'

function ThankYouContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const plan = searchParams.get('plan') || 'pro' // pro | enterprise
  const [syncing, setSyncing] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // 紙吹雪演出
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fb923c', '#fbbf24', '#10b981', '#3b82f6'],
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // セッション同期
  useEffect(() => {
    if (!sessionId) {
      setSyncError('セッションIDが見つかりません')
      setSyncing(false)
      return
    }

    const syncSubscription = async () => {
      try {
        const res = await fetch('/api/stripe/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || '同期に失敗しました')
        }
        // 成功：少し待ってから「準備完了」を表示
        setTimeout(() => {
          setSyncing(false)
          setReady(true)
        }, 1500)
      } catch (e) {
        console.error('Sync error:', e)
        setSyncError(e instanceof Error ? e.message : '同期エラー')
        setSyncing(false)
        // エラーでも「準備完了」は表示（後で反映される）
        setTimeout(() => setReady(true), 1000)
      }
    }

    syncSubscription()
  }, [sessionId])

  const planConfig = {
    pro: {
      name: 'PRO',
      icon: Crown,
      color: 'from-purple-600 to-pink-600',
      description: '動画ファイルもアップロード可能（最大5GB）',
      features: [
        '動画ファイルもアップロード可能（最大5GB）',
        '音声ファイル（最大5GB）',
        'すべての機能が利用可能',
        '優先サポート',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      icon: Zap,
      color: 'from-indigo-600 to-blue-600',
      description: '大容量動画ファイルもアップロード可能（最大10GB）',
      features: [
        '大容量動画ファイルもアップロード可能（最大10GB）',
        '音声ファイル（最大10GB）',
        'すべての機能が利用可能',
        '専用サポート',
      ],
    },
  }

  const config = planConfig[plan as keyof typeof planConfig] || planConfig.pro
  const IconComponent = config.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-2xl w-full"
      >
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-100">
          {/* Header */}
          <div className={`relative px-8 py-12 bg-gradient-to-r ${config.color} text-white text-center overflow-hidden`}>
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white blur-3xl" />
            </div>
            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-4 border-white/30"
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-black mb-3"
              >
                ご契約ありがとうございます！
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg font-bold text-white/90"
              >
                {config.name}プランが有効になりました
              </motion.p>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-10">
            <AnimatePresence mode="wait">
              {syncing ? (
                <motion.div
                  key="syncing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-700 font-bold">プランを反映しています...</p>
                  <p className="text-sm text-slate-500 mt-2">少々お待ちください</p>
                </motion.div>
              ) : ready ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {syncError && (
                    <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
                      <p className="text-sm font-bold text-yellow-800">
                        ⚠️ {syncError}
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        プランは後で自動反映されます。しばらくお待ちください。
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-700 text-sm font-black mb-6">
                      <IconComponent className="w-4 h-4" />
                      {config.name}プラン
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">
                      準備完了！
                    </h2>
                    <p className="text-slate-600 font-bold mb-8">
                      ドヤインタビューAIの全機能が使えるようになりました
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-orange-600" />
                        {config.name}プランの特典
                      </h3>
                      <ul className="space-y-2 text-sm text-slate-700">
                        {config.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* メインアクション */}
                    <Link href="/interview">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full py-4 rounded-xl bg-gradient-to-r ${config.color} text-white font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 hover:opacity-95 transition-all`}
                      >
                        インタビューを開始する
                        <ArrowRight className="w-5 h-5" />
                      </motion.button>
                    </Link>

                    {/* サブアクション */}
                    <Link href="/interview/settings">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full py-3 rounded-xl bg-white border-2 border-orange-200 text-orange-700 font-black text-base flex items-center justify-center gap-2 hover:bg-orange-50 transition-all"
                      >
                        設定を確認する
                      </motion.button>
                    </Link>

                    <div className="text-center pt-2">
                      <Link
                        href="/interview/plan"
                        className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        プラン詳細を確認する →
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function InterviewThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
            <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-700 font-bold">読み込み中...</p>
          </div>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  )
}

