'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle2, ArrowRight, Loader2, Crown } from 'lucide-react'
import confetti from 'canvas-confetti'
import Link from 'next/link'

function ThankYouProContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const service = searchParams.get('service') || 'seo' // seo, banner, persona
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
        colors: ['#a855f7', '#ec4899', '#60a5fa', '#f59e0b', '#10b981'],
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

  const serviceConfig = {
    seo: {
      name: 'ドヤライティングAI',
      primaryHref: '/seo',
      primaryAction: '記事を生成する',
      secondaryHref: '/seo/articles',
      secondaryAction: '記事一覧を見る',
      description: 'AIが自動で記事を生成します',
      features: [
        '1日の生成回数が大幅に増加',
        '画像生成・図解機能が利用可能',
        'AI自動修正・改善提案が有効',
        '履歴保存期間が延長',
      ],
    },
    banner: {
      name: 'ドヤバナーAI',
      primaryHref: '/banner',
      primaryAction: 'バナーを生成する',
      secondaryHref: '/banner/dashboard',
      secondaryAction: 'ダッシュボードを見る',
      description: 'AIが自動でバナーを生成します',
      features: [
        '1日の生成回数が大幅に増加',
        '高品質なバナー画像を生成',
        'URLから自動でバナー生成',
        '履歴保存期間が延長',
      ],
    },
    persona: {
      name: 'ドヤペルソナAI',
      primaryHref: '/persona',
      primaryAction: 'ペルソナを生成する',
      secondaryHref: '/persona/history',
      secondaryAction: '履歴を見る',
      description: 'AIが自動でペルソナを生成します',
      features: [
        '1日の生成回数が大幅に増加',
        '詳細なペルソナ分析が可能',
        '日記・スケジュール画像も生成',
        '履歴保存期間が延長',
      ],
    },
  }

  const config = serviceConfig[service as keyof typeof serviceConfig] || serviceConfig.seo

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-2xl w-full"
      >
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100">
          {/* Header */}
          <div className="relative px-8 py-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-center overflow-hidden">
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
                PROプランが有効になりました
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
                  <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
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
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-black mb-6">
                      <Crown className="w-4 h-4" />
                      PROプラン
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">
                      準備完了！
                    </h2>
                    <p className="text-slate-600 font-bold mb-8">
                      {config.name}の全機能が使えるようになりました
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        PROプランの特典
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
                    <Link href={config.primaryHref}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-pink-500 transition-all"
                      >
                        {config.primaryAction}
                        <ArrowRight className="w-5 h-5" />
                      </motion.button>
                    </Link>

                    {/* サブアクション */}
                    <Link href={config.secondaryHref}>
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full py-3 rounded-xl bg-white border-2 border-purple-200 text-purple-700 font-black text-base flex items-center justify-center gap-2 hover:bg-purple-50 transition-all"
                      >
                        {config.secondaryAction}
                      </motion.button>
                    </Link>

                    <div className="text-center pt-2">
                      <Link
                        href="/pricing"
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

export default function ThankYouProPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-700 font-bold">読み込み中...</p>
          </div>
        </div>
      }
    >
      <ThankYouProContent />
    </Suspense>
  )
}

