'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SwipeCard, SwipeDecision } from '@/components/seo/SwipeCard'
import { shouldShowQuestion } from '@seo/lib/swipe-questions'
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'

type Step = 'keyword' | 'swipe' | 'conditions' | 'primary' | 'confirm' | 'generating'

export default function SwipeArticlePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('keyword')
  const [mainKeyword, setMainKeyword] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [swipeLog, setSwipeLog] = useState<Record<string, SwipeDecision>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [finalConditions, setFinalConditions] = useState<{
    targetChars: number
    articleType: string
  } | null>(null)
  const [primaryInfo, setPrimaryInfo] = useState<{
    results: string
    experience: string
    opinion: string
    fixedPhrase: string
  }>({
    results: '',
    experience: '',
    opinion: '',
    fixedPhrase: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // セッション開始
  const handleStart = async () => {
    if (!mainKeyword.trim()) {
      setError('キーワードを入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/swipe/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainKeyword: mainKeyword.trim() }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'セッション開始に失敗しました')
      }

      setSessionId(json.sessionId)
      setQuestions(json.questions || [])
      setStep('swipe')
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // スワイプログ保存
  const saveSwipeLog = useCallback(
    async (newSwipeLog: Record<string, SwipeDecision>) => {
      if (!sessionId) return

      try {
        await fetch('/api/swipe/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            swipes: Object.entries(newSwipeLog).map(([questionId, decision]) => ({
              questionId,
              decision,
              category: questions.find((q) => q.id === questionId)?.category || 'unknown',
            })),
          }),
        })
      } catch {
        // エラーは無視（オフライン対応）
      }
    },
    [sessionId, questions]
  )

  // スワイプ処理
  const handleSwipe = (decision: SwipeDecision) => {
    const currentQuestion = getAvailableQuestions()[currentQuestionIndex]
    if (!currentQuestion) return

    const newSwipeLog = { ...swipeLog, [currentQuestion.id]: decision }
    setSwipeLog(newSwipeLog)
    saveSwipeLog(newSwipeLog)

    // 次の質問へ
    const nextQuestions = getAvailableQuestions(newSwipeLog)
    if (currentQuestionIndex + 1 < nextQuestions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // すべての質問に回答済み
      setStep('conditions')
    }
  }

  // 利用可能な質問を取得
  const getAvailableQuestions = (log: Record<string, SwipeDecision> = swipeLog) => {
    return questions.filter((q) => shouldShowQuestion(q, log))
  }

  // 記事生成
  const handleGenerate = async () => {
    if (!sessionId || !finalConditions) return

    setLoading(true)
    setError(null)
    setStep('generating')

    try {
      const res = await fetch('/api/swipe/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          finalConditions,
          primaryInfo,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || '記事生成に失敗しました')
      }

      // 生成画面にリダイレクト
      router.push(`/seo/jobs/${json.jobId}?auto=1`)
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
      setStep('confirm')
    } finally {
      setLoading(false)
    }
  }

  const availableQuestions = getAvailableQuestions()
  const progress = availableQuestions.length > 0
    ? ((currentQuestionIndex + 1) / availableQuestions.length) * 100
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* ステップ1: キーワード入力 */}
          {step === 'keyword' && (
            <motion.div
              key="keyword"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl shadow-xl p-8 sm:p-12"
            >
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
                SEO ライティング AI
              </h1>
              <p className="text-sm font-bold text-gray-600 mb-8">
                最初に狙いたいキーワードを入力してください
              </p>

              <div className="space-y-4">
                <input
                  type="text"
                  value={mainKeyword}
                  onChange={(e) => setMainKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  placeholder="例: AIライティングツール"
                  className="w-full px-6 py-4 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg font-bold"
                  disabled={loading}
                />

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleStart}
                  disabled={loading || !mainKeyword.trim()}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      開始中...
                    </>
                  ) : (
                    <>
                      スタートする
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ステップ2: スワイプ */}
          {step === 'swipe' && (
            <motion.div
              key="swipe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative"
            >
              <div className="h-[600px] relative">
                {availableQuestions
                  .slice(currentQuestionIndex, currentQuestionIndex + 3)
                  .map((q, i) => (
                    <SwipeCard
                      key={q.id}
                      question={q}
                      onSwipe={handleSwipe}
                      index={i}
                      total={availableQuestions.length}
                    />
                  ))}
              </div>

              {/* 進捗表示 */}
              <div className="mt-6 text-center">
                <p className="text-sm font-bold text-gray-600">
                  {currentQuestionIndex + 1} / {availableQuestions.length}
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden max-w-md mx-auto">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ステップ3: 最終条件入力 */}
          {step === 'conditions' && (
            <motion.div
              key="conditions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-3xl shadow-xl p-8 sm:p-12"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-8">
                最終条件を入力
              </h2>

              <div className="space-y-8">
                {/* 文字数選択 */}
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-4">
                    記事文字数
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[2000, 4000, 6000, 8000].map((chars) => (
                      <button
                        key={chars}
                        onClick={() =>
                          setFinalConditions((prev) => ({
                            ...prev,
                            targetChars: chars,
                            articleType: prev?.articleType || '解説記事',
                          }))
                        }
                        className={`px-4 py-3 rounded-xl border-2 font-black transition-all ${
                          finalConditions?.targetChars === chars
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        約{chars.toLocaleString()}文字
                      </button>
                    ))}
                  </div>
                </div>

                {/* 記事タイプ選択 */}
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-4">
                    記事タイプ
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['解説記事', '比較記事', 'HowTo / 手順解説', 'まとめ・一覧型'].map(
                      (type) => (
                        <button
                          key={type}
                          onClick={() =>
                            setFinalConditions((prev) => ({
                              ...prev,
                              articleType: type,
                              targetChars: prev?.targetChars || 4000,
                            }))
                          }
                          className={`px-4 py-3 rounded-xl border-2 font-black transition-all ${
                            finalConditions?.articleType === type
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {type}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('swipe')}
                    className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    戻る
                  </button>
                  <button
                    onClick={() => setStep('primary')}
                    disabled={!finalConditions?.targetChars || !finalConditions?.articleType}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    次へ
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ステップ4: 一次情報入力 */}
          {step === 'primary' && (
            <motion.div
              key="primary"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-3xl shadow-xl p-8 sm:p-12"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
                一次情報を入力（任意）
              </h2>
              <p className="text-sm font-bold text-gray-500 mb-8">
                一次情報を入れるほど、記事の独自性と説得力が増します
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">
                    実績・数値データ
                  </label>
                  <textarea
                    value={primaryInfo.results}
                    onChange={(e) =>
                      setPrimaryInfo((prev) => ({ ...prev, results: e.target.value }))
                    }
                    placeholder="例: 累計500社以上の支援実績、売上3倍達成など"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">
                    実体験・感想
                  </label>
                  <textarea
                    value={primaryInfo.experience}
                    onChange={(e) =>
                      setPrimaryInfo((prev) => ({ ...prev, experience: e.target.value }))
                    }
                    placeholder="例: 実際に使ってみた感想、現場での失敗談など"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">
                    独自の考え・スタンス
                  </label>
                  <textarea
                    value={primaryInfo.opinion}
                    onChange={(e) =>
                      setPrimaryInfo((prev) => ({ ...prev, opinion: e.target.value }))
                    }
                    placeholder="例: 〇〇は重要だが、△△も考慮すべきという独自の主張"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">
                    必ず含めたい固定文言（言い換え禁止）
                  </label>
                  <textarea
                    value={primaryInfo.fixedPhrase}
                    onChange={(e) =>
                      setPrimaryInfo((prev) => ({ ...prev, fixedPhrase: e.target.value }))
                    }
                    placeholder="例: 「当社の独自技術により...」など、そのまま使いたい文言"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('conditions')}
                    className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    戻る
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-lg shadow-blue-500/20 hover:opacity-95 transition-all flex items-center justify-center gap-2"
                  >
                    確認画面へ
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ステップ5: 確認画面 */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-3xl shadow-xl p-8 sm:p-12"
            >
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-8">
                生成内容の確認
              </h2>

              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-blue-50 border border-blue-200">
                  <h3 className="text-lg font-black text-blue-900 mb-4">生成予定タイトル</h3>
                  <p className="text-base font-bold text-blue-800">
                    {mainKeyword}
                    {finalConditions?.articleType === '比較記事'
                      ? '比較'
                      : finalConditions?.articleType === 'HowTo / 手順解説'
                        ? 'のやり方'
                        : 'とは？'}
                    ｜{finalConditions?.articleType}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                      キーワード
                    </p>
                    <p className="text-sm font-black text-gray-900">{mainKeyword}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                      文字数
                    </p>
                    <p className="text-sm font-black text-gray-900">
                      約{finalConditions?.targetChars.toLocaleString()}文字
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                      記事タイプ
                    </p>
                    <p className="text-sm font-black text-gray-900">
                      {finalConditions?.articleType}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">
                      採用した構成要素
                    </p>
                    <p className="text-sm font-bold text-gray-700">
                      {Object.entries(swipeLog)
                        .filter(([_, d]) => d === 'yes')
                        .length}
                      個
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                    {error}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('primary')}
                    className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-700 font-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    戻って調整
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        この内容で記事を生成する
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ステップ6: 生成中 */}
          {step === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl shadow-xl p-8 sm:p-12 text-center"
            >
              <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-900 mb-2">記事を生成中...</h2>
              <p className="text-sm font-bold text-gray-500">
                しばらくお待ちください
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
