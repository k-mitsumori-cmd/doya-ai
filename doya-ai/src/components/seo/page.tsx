'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { TinderSwipeCard, SwipeDecision } from '@/components/seo/TinderSwipeCard'
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
  const [questionQueue, setQuestionQueue] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [progress, setProgress] = useState(0) // 進捗（0-100）
  const [finalData, setFinalData] = useState<{
    title: string
    targetChars: number
    summary?: string
  } | null>(null)
  const [celebrationImage, setCelebrationImage] = useState<{
    imageBase64: string
    mimeType: string
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
      setQuestionQueue(json.questions || [])
      setStep('swipe')
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 次の質問バッチを生成
  const loadNextQuestions = useCallback(async () => {
    if (!sessionId || isGeneratingQuestion) return

    setIsGeneratingQuestion(true)
    try {
      const res = await fetch('/api/swipe/test/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.error) {
        throw new Error(json?.error || '質問生成に失敗しました')
      }

      if (json.done) {
        // 質問が完了したら最終確認へ
        setFinalData(json.finalData)
        
        // 完了時の画像を取得
        try {
          const imgRes = await fetch('/api/swipe/celebration-images?category=thanks&count=1')
          const imgJson = await imgRes.json()
          if (imgJson.success && imgJson.images?.[0]) {
            setCelebrationImage({
              imageBase64: imgJson.images[0].imageBase64,
              mimeType: imgJson.images[0].mimeType,
            })
          }
        } catch (e) {
          console.warn('Failed to load celebration image:', e)
        }
        
        setStep('confirm')
      } else if (json.questions && Array.isArray(json.questions)) {
        // 新しい質問をキューに追加
        setQuestionQueue((prev) => [...prev, ...json.questions])
      }
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsGeneratingQuestion(false)
    }
  }, [sessionId, answers, isGeneratingQuestion])

  // スワイプ処理
  const handleSwipe = async (decision: SwipeDecision, question: Question) => {
    if (!question || !sessionId || decision === 'hold') return

    const answer: Answer = {
      questionId: question.id,
      question: question.question,
      answer: decision === 'yes' ? 'yes' : 'no',
    }

    const newAnswers = [...answers, answer]
    setAnswers(newAnswers)

    // 現在の質問をキューから削除
    setQuestionQueue((prev) => prev.filter((q) => q.id !== question.id))

    // 進捗を更新（完了まで100%に到達しないように、適度な進捗を表示）
    // 完了フラグが出るまで実際の進捗は不明なので、回答数に基づいて進捗を更新
    // 意図が違った場合は戻す機能は後で実装
    const estimatedProgress = Math.min(95, (newAnswers.length / Math.max(1, newAnswers.length + 3)) * 100)
    setProgress(estimatedProgress)

    // 残り1-2枚になったら次のバッチを生成
    if (questionQueue.length <= 2) {
      loadNextQuestions()
    }
  }

  // 初期ロード時にも次のバッチを生成
  useEffect(() => {
    if (step === 'swipe' && questionQueue.length <= 1 && !isGeneratingQuestion) {
      loadNextQuestions()
    }
  }, [step, questionQueue.length, isGeneratingQuestion, loadNextQuestions])

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
      <div className="max-w-5xl mx-auto px-4 py-8">
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
          <div className="relative ml-0 sm:ml-64">
            {/* 背景の操作説明 */}
            <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-between px-8 opacity-20">
              <div className="text-left">
                <p className="text-7xl font-black bg-gradient-to-br from-red-400 to-red-600 bg-clip-text text-transparent leading-none">NO</p>
                <p className="text-sm font-black text-red-500 mt-2">左にスワイプ</p>
              </div>
              <div className="text-right">
                <p className="text-7xl font-black bg-gradient-to-br from-emerald-400 to-emerald-600 bg-clip-text text-transparent leading-none">YES</p>
                <p className="text-sm font-black text-emerald-500 mt-2">右にスワイプ</p>
              </div>
            </div>

            {/* カードスタック */}
            <div className="relative h-[700px] mb-8 z-10">
              {questionQueue.length > 0 ? (
                questionQueue.slice(0, 4).map((question, index) => (
                  <TinderSwipeCard
                    key={question.id}
                    question={question}
                    onSwipe={(decision) => handleSwipe(decision, question)}
                    index={index}
                    total={questionQueue.length}
                  />
                ))
              ) : (
                <div className="bg-white rounded-3xl shadow-2xl p-12 text-center h-full flex items-center justify-center">
                  {isGeneratingQuestion ? (
                    <>
                      <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
                      <p className="text-gray-600 font-bold">AIが次の質問を考えています...</p>
                    </>
                  ) : (
                    <p className="text-gray-400 font-bold">読み込み中...</p>
                  )}
                </div>
              )}
            </div>

            {/* 進捗バー（下部） */}
            <div className="fixed bottom-0 left-0 sm:left-64 right-0 bg-white border-t border-gray-200 shadow-lg z-50 p-6">
              <div className="max-w-5xl mx-auto">
                <div className="w-full h-6 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                {isGeneratingQuestion && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-bold">次の質問を生成中...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ステップ3: 最終確認 */}
        {step === 'confirm' && finalData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            {/* 完了時の画像表示 */}
            {celebrationImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 rounded-xl overflow-hidden"
              >
                <img
                  src={`data:${celebrationImage.mimeType};base64,${celebrationImage.imageBase64}`}
                  alt="ありがとうございました"
                  className="w-full h-auto rounded-xl shadow-lg"
                />
              </motion.div>
            )}
            
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

              {finalData.summary && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    質問回答から得た情報と記事の方向性
                  </label>
                  <div className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {finalData.summary}
                    </p>
                  </div>
                </div>
              )}
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
