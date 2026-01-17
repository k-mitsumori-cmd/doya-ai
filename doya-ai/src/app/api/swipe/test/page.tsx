'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SwipeCard, SwipeDecision } from '@/components/seo/SwipeCard'
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, X } from 'lucide-react'

type Step = 'keyword' | 'swipe' | 'confirm' | 'generating'

interface Question {
  id: string
  question: string
  description?: string
  category: string
}

interface Answer {
  questionId: string
  question: string
  answer: 'yes' | 'no'
}

export default function TestSwipePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('keyword')
  const [keywords, setKeywords] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [finalData, setFinalData] = useState<{
    title: string
    targetChars: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // セッション開始
  const handleStart = async () => {
    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
    if (keywordList.length === 0) {
      setError('キーワードを入力してください（カンマ区切りで複数入力可）')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/swipe/test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordList }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'セッション開始に失敗しました')
      }

      setSessionId(json.sessionId)
      setCurrentQuestion(json.question)
      setStep('swipe')
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // スワイプ処理
  const handleSwipe = async (decision: SwipeDecision) => {
    if (!currentQuestion || !sessionId || decision === 'hold') return

    const answer: Answer = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      answer: decision === 'yes' ? 'yes' : 'no',
    }

    const newAnswers = [...answers, answer]
    setAnswers(newAnswers)

    // 次の質問を生成
    setIsGeneratingQuestion(true)
    try {
      const res = await fetch('/api/swipe/test/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers: newAnswers,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || '質問生成に失敗しました')
      }

      if (json.done) {
        // 質問が完了したら最終確認へ
        setFinalData(json.finalData)
        setStep('confirm')
      } else {
        setCurrentQuestion(json.question)
      }
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsGeneratingQuestion(false)
    }
  }

  // 最終確認で記事生成
  const handleGenerate = async () => {
    if (!sessionId || !finalData) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/swipe/test/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          finalData,
          answers,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || '記事生成に失敗しました')
      }

      // 記事生成ジョブページへリダイレクト
      router.push(`/seo/jobs/${json.jobId}`)
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">スワイプ記事作成（テスト版）</h1>
          <p className="text-gray-600">AIが動的に質問を生成します。Yes/Noでスワイプして回答してください。</p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 font-bold">{error}</p>
          </div>
        )}

        {/* ステップ1: キーワード入力 */}
        {step === 'keyword' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h2 className="text-2xl font-black text-gray-900 mb-4">狙いたいキーワードを入力</h2>
            <p className="text-gray-600 mb-6">カンマ区切りで複数のキーワードを入力できます</p>

            <div className="mb-6">
              <textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例: AIライティングツール, 記事作成ツール, コンテンツマーケティング"
                className="w-full h-32 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none font-bold text-gray-900 resize-none"
              />
            </div>

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  セッションを開始中...
                </>
              ) : (
                <>
                  スタートする <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* ステップ2: スワイプ */}
        {step === 'swipe' && (
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-gray-900">質問 {answers.length + 1}</h2>
                {isGeneratingQuestion && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-bold">次の質問を生成中...</span>
                  </div>
                )}
              </div>
            </div>

            {currentQuestion && !isGeneratingQuestion && (
              <div className="relative h-[600px]">
                <SwipeCard
                  question={currentQuestion}
                  onSwipe={handleSwipe}
                  index={0}
                  total={1}
                />
              </div>
            )}

            {isGeneratingQuestion && (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
                <p className="text-gray-600 font-bold">AIが次の質問を考えています...</p>
              </div>
            )}
          </div>
        )}

        {/* ステップ3: 最終確認 */}
        {step === 'confirm' && finalData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h2 className="text-2xl font-black text-gray-900 mb-6">最終確認</h2>

            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">記事タイトル</label>
                <input
                  type="text"
                  value={finalData.title}
                  onChange={(e) => setFinalData({ ...finalData, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">文字数</label>
                <select
                  value={finalData.targetChars}
                  onChange={(e) => setFinalData({ ...finalData, targetChars: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none font-bold text-gray-900"
                >
                  <option value={2000}>約2,000文字</option>
                  <option value={4000}>約4,000文字</option>
                  <option value={6000}>約6,000文字</option>
                  <option value={8000}>約8,000文字</option>
                  <option value={10000}>約10,000文字</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('swipe')}
                className="flex-1 py-4 bg-gray-100 text-gray-700 font-black rounded-xl hover:bg-gray-200 transition-all"
              >
                <ArrowLeft className="w-5 h-5 inline-block mr-2" />
                戻る
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    この内容で記事を生成する
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
