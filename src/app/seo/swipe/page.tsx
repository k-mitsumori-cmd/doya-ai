'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { TinderSwipeCard, SwipeDecision } from '@/components/seo/TinderSwipeCard'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, X, Lock, Check, RefreshCw, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react'

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
  category?: string
}

// プラン別文字数上限
const CHAR_LIMITS: Record<string, number> = {
  GUEST: 5000,
  FREE: 10000,
  PRO: 20000,
  ENTERPRISE: 50000,
}

export default function SwipeArticlePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [step, setStep] = useState<Step>('keyword')
  const [keywords, setKeywords] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questionQueue, setQuestionQueue] = useState<Question[]>([])
  const [questionImages, setQuestionImages] = useState<
    Map<string, { imageBase64?: string; mimeType?: string; url?: string }>
  >(new Map())
  const [answers, setAnswers] = useState<Answer[]>([])
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [isTransitioningQuestion, setIsTransitioningQuestion] = useState(false)
  const [progress, setProgress] = useState(0) // 進捗（0-100）
  const [finalData, setFinalData] = useState<{
    title: string
    titleCandidates?: string[]
    targetChars: number
    summary?: string
    answersByCategory?: Record<string, { question: string; answer: string }[]>
    totalAnswers?: number
    yesCount?: number
    noCount?: number
  } | null>(null)
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0)
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false)
  const [primaryInfoText, setPrimaryInfoText] = useState('')
  const [celebrationImage, setCelebrationImage] = useState<{
    imageBase64: string
    mimeType: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ユーザープラン情報
  const userPlan = useMemo(() => {
    const user: any = session?.user || null
    const plan = user?.seoPlan || user?.plan || (user ? 'FREE' : 'GUEST')
    return String(plan).toUpperCase() as 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'
  }, [session])
  const charLimit = useMemo(() => CHAR_LIMITS[userPlan] || 10000, [userPlan])
  const isLoggedIn = !!session?.user

  const thinkingMessages = useMemo(
    () => [
      '回答ありがとう。次に聞くべき質問を選んでいます…',
      'いまの回答を要約して、記事の方向性を整えています…',
      '読者が迷いやすいポイントを洗い出しています…',
      '検索意図にズレがないかチェック中…',
      '次の質問を作成中。もうすぐ表示します…',
    ],
    []
  )
  const [thinkingIdx, setThinkingIdx] = useState(0)
  const showThinking = step === 'swipe' && (isGeneratingQuestion || isTransitioningQuestion || loading)

  useEffect(() => {
    if (!showThinking) return
    setThinkingIdx(0)
    const t = window.setInterval(() => setThinkingIdx((i) => i + 1), 1800)
    return () => window.clearInterval(t)
  }, [showThinking])

  const recommendedTargetChars = useMemo(() => {
    const kwCount = keywords.split(',').map((k) => k.trim()).filter(Boolean).length
    const yesCount = answers.filter((a) => a.answer === 'yes').length
    // 雑に「情報量が多そう」な時は長めに寄せる
    if (kwCount >= 3) return 10000
    if (kwCount === 2) return 8000
    if (yesCount >= 18) return 8000
    if (yesCount >= 10) return 6000
    return 4000
  }, [answers, keywords])

  const charPresets = useMemo(
    () => [
      { value: recommendedTargetChars, label: 'おすすめ', desc: `${recommendedTargetChars.toLocaleString()}字（推定）` },
      { value: 2000, label: '2,000字', desc: '短め' },
      { value: 4000, label: '4,000字', desc: '標準' },
      { value: 6000, label: '6,000字', desc: 'しっかり' },
      { value: 8000, label: '8,000字', desc: '濃いめ' },
      { value: 10000, label: '10,000字', desc: '網羅' },
      { value: 20000, label: '20,000字', desc: '詳細' },
      { value: 30000, label: '30,000字', desc: '充実' },
      { value: 40000, label: '40,000字', desc: '徹底' },
      { value: 50000, label: '50,000字', desc: '完全版' },
    ],
    [recommendedTargetChars]
  )

  const summaryMarkdown = useMemo(() => {
    let s = String(finalData?.summary || '').replace(/\r\n/g, '\n').trim()
    if (!s) return ''

    // 箇条書きをMarkdownに寄せる
    s = s.replace(/^・\s*/gm, '- ')
    s = s.replace(/^[＊*]\s*/gm, '- ')

    // Q/A表記を読みやすく
    s = s.replace(/^Q:\s*(.+)$/gm, '- **Q**: $1')
    s = s.replace(/^A:\s*(.+)$/gm, '  - **A**: $1')
    s = s.replace(/\n(- \*\*Q\*\*:[^\n]+)\n(  - \*\*A\*\*:[^\n]+)/g, '\n\n$1\n$2')

    // 段落が詰まりすぎる場合に少し空行を補う
    s = s.replace(/\n{3,}/g, '\n\n')
    s = s.replace(/\n(- )/g, '\n\n$1')

    // 見出しが無い場合は付与
    if (!/^#{1,6}\s/m.test(s)) {
      s = `## 質問回答から得た情報と記事の方向性\n\n${s}`
    }
    return s
  }, [finalData?.summary])

  const bgOrbs = useMemo(() => {
    // deterministic “game-like” floating orbs (no Math.random during render)
    return [
      { x: '8%', y: '18%', size: 280, c: 'from-emerald-200/55 to-teal-200/10', d: 10 },
      { x: '88%', y: '12%', size: 220, c: 'from-sky-200/55 to-indigo-200/10', d: 12 },
      { x: '86%', y: '78%', size: 300, c: 'from-rose-200/45 to-orange-200/10', d: 11 },
      { x: '18%', y: '84%', size: 240, c: 'from-amber-200/45 to-lime-200/10', d: 13 },
    ] as const
  }, [])

  // セッション開始
  const handleStart = async () => {
    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
    if (keywordList.length === 0) {
      setError('キーワードを入力してください（カンマ区切りで複数入力可）')
      return
    }

    // クリック直後から「何もない時間」を作らない
    setLoading(true)
    setError(null)
    setQuestionQueue([])
    setQuestionImages(new Map())
    setIsTransitioningQuestion(true)
    setStep('swipe')

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
      const questions = json.questions || []
      setQuestionQueue(questions)
      
      // 画像を並列で取得（非同期、ブロッキングしない）
      // カテゴリごとに画像を取得し、同じカテゴリの質問には同じ画像を使用
      const categoryImageMap = new Map<string, { imageBase64?: string; mimeType?: string; url?: string }>()
      
      const categories = Array.from(new Set(questions.map((q: Question) => String(q.category))))
      Promise.all(
        categories.map(async (category) => {
          // リトライ機能付きで画像を取得
          let retryCount = 0
          const maxRetries = 3
          
          while (retryCount < maxRetries) {
            try {
              const imgRes = await fetch(`/api/swipe/question-images?category=${encodeURIComponent(String(category))}&count=1`)
              if (!imgRes.ok) {
                throw new Error(`HTTP ${imgRes.status}`)
              }
              const imgJson = await imgRes.json() as {
                success?: boolean
                images?: Array<{ imageBase64?: string; mimeType?: string; url?: string }>
              }
              const first = imgJson.images?.[0]
              if (imgJson.success && first && (first.imageBase64 || first.url)) {
                categoryImageMap.set(String(category), {
                  imageBase64: first.imageBase64 ? String(first.imageBase64) : undefined,
                  url: first.url ? String(first.url) : undefined,
                  mimeType: String(first.mimeType || 'image/png'),
                })
                return // 成功したら終了
              } else {
                throw new Error('画像データなし')
              }
            } catch (e) {
              retryCount++
              if (retryCount >= maxRetries) {
                console.warn(`[画像取得失敗] category: ${category}, リトライ上限に達しました`, e)
                // 最後の試行でも失敗した場合、デフォルトカテゴリから取得を試みる
                try {
                  const defaultRes = await fetch(`/api/swipe/question-images?category=確認&count=1`)
                  if (defaultRes.ok) {
                    const defaultJson = await defaultRes.json() as {
                      success?: boolean
                      images?: Array<{ imageBase64?: string; mimeType?: string; url?: string }>
                    }
                    const first = defaultJson.images?.[0]
                    if (defaultJson.success && first && (first.imageBase64 || first.url)) {
                      categoryImageMap.set(String(category), {
                        imageBase64: first.imageBase64 ? String(first.imageBase64) : undefined,
                        url: first.url ? String(first.url) : undefined,
                        mimeType: String(first.mimeType || 'image/png'),
                      })
                    }
                  }
                } catch (defaultError) {
                  console.warn(`[デフォルト画像取得も失敗] category: ${category}`, defaultError)
                }
              } else {
                // リトライ前に待機
                await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
              }
            }
          }
        })
      ).then(() => {
        // カテゴリごとの画像を質問に割り当て
        setQuestionImages((prev) => {
          const newMap = new Map(prev)
          questions.forEach((q: Question) => {
            const categoryImage = categoryImageMap.get(q.category)
            if (categoryImage) {
              newMap.set(q.id, categoryImage)
            }
          })
          return newMap
        })
      }).catch((e) => {
        console.warn('[画像取得一括エラー]', e)
        // エラーは無視
      })
      
      // 質問が来たら、ローディングはuseEffectで自動的に消える
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
      setStep('keyword')
      setIsTransitioningQuestion(false)
    } finally {
      setLoading(false)
    }
  }

  // 次の質問バッチを生成（リトライ機能付き）
  const loadNextQuestions = useCallback(async (retryCount = 0) => {
    if (!sessionId || isGeneratingQuestion) return

    setIsGeneratingQuestion(true)
    setIsTransitioningQuestion(true)
    setError(null) // エラーをクリア
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
        // リトライ（最大3回）
        if (retryCount < 3) {
          console.warn(`[質問生成リトライ] 試行回数: ${retryCount + 1}`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // 指数バックオフ
          return loadNextQuestions(retryCount + 1)
        }
        throw new Error(json?.error || '質問生成に失敗しました')
      }

      if (json.done) {
        // 質問が完了したら最終確認へ
        // プラン上限を超えている場合は上限に調整
        const currentYear = new Date().getFullYear()
        const keywordParts = keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        const mainKeyword = keywordParts[0] || 'キーワード'
        
        // titleCandidatesが存在しない場合はデフォルトを生成
        let titleCandidates = json.finalData?.titleCandidates
        if (!titleCandidates || !Array.isArray(titleCandidates) || titleCandidates.length === 0) {
          const defaultTitle = json.finalData?.title || `「${mainKeyword}」完全ガイド【${currentYear}年最新版】`
          titleCandidates = [
            defaultTitle,
            `${mainKeyword}比較｜目的別おすすめ＆導入前の注意点`,
            `失敗しない！${mainKeyword}【${currentYear}年版】選び方ガイド`,
            `プロが解説｜${mainKeyword}で見るべきポイント`,
            `${mainKeyword}：初心者向け｜無料から始める活用術`,
            `${mainKeyword}｜導入前に知っておくべき落とし穴`,
          ]
        }
        
        const adjustedFinalData = {
          ...json.finalData,
          titleCandidates,
          title: json.finalData?.title || titleCandidates[0],
          targetChars: Math.min(json.finalData?.targetChars || 4000, charLimit),
        }
        setFinalData(adjustedFinalData)
        
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
      } else if (json.questions && Array.isArray(json.questions) && json.questions.length > 0) {
        // 新しい質問をキューに追加
        setQuestionQueue((prev) => [...prev, ...json.questions])
        
        // 画像を並列で取得（非同期、ブロッキングしない）
        // カテゴリごとに画像を取得し、同じカテゴリの質問には同じ画像を使用
        const categoryImageMap = new Map<string, { imageBase64?: string; mimeType?: string; url?: string }>()
        const newQuestions = json.questions as Question[]
        
        const categories = Array.from(new Set(newQuestions.map((q: Question) => String(q.category))))
        Promise.all(
          categories.map(async (category) => {
            // リトライ機能付きで画像を取得
            let retryCount = 0
            const maxRetries = 3
            
            while (retryCount < maxRetries) {
              try {
                const imgRes = await fetch(`/api/swipe/question-images?category=${encodeURIComponent(String(category))}&count=1`)
                if (!imgRes.ok) {
                  throw new Error(`HTTP ${imgRes.status}`)
                }
                const imgJson = await imgRes.json() as {
                  success?: boolean
                  images?: Array<{ imageBase64?: string; mimeType?: string; url?: string }>
                }
                const first = imgJson.images?.[0]
                if (imgJson.success && first && (first.imageBase64 || first.url)) {
                  categoryImageMap.set(String(category), {
                    imageBase64: first.imageBase64 ? String(first.imageBase64) : undefined,
                    url: first.url ? String(first.url) : undefined,
                    mimeType: String(first.mimeType || 'image/png'),
                  })
                  return // 成功したら終了
                } else {
                  throw new Error('画像データなし')
                }
              } catch (e) {
                retryCount++
                if (retryCount >= maxRetries) {
                  console.warn(`[画像取得失敗] category: ${category}, リトライ上限に達しました`, e)
                  // 最後の試行でも失敗した場合、デフォルトカテゴリから取得を試みる
                  try {
                    const defaultRes = await fetch(`/api/swipe/question-images?category=確認&count=1`)
                    if (defaultRes.ok) {
                      const defaultJson = await defaultRes.json() as {
                        success?: boolean
                        images?: Array<{ imageBase64?: string; mimeType?: string; url?: string }>
                      }
                      const first = defaultJson.images?.[0]
                      if (defaultJson.success && first && (first.imageBase64 || first.url)) {
                        categoryImageMap.set(String(category), {
                          imageBase64: first.imageBase64 ? String(first.imageBase64) : undefined,
                          url: first.url ? String(first.url) : undefined,
                          mimeType: String(first.mimeType || 'image/png'),
                        })
                      }
                    }
                  } catch (defaultError) {
                    console.warn(`[デフォルト画像取得も失敗] category: ${category}`, defaultError)
                  }
                } else {
                  // リトライ前に待機
                  await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
                }
              }
            }
          })
        ).then(() => {
          // カテゴリごとの画像を質問に割り当て
          setQuestionImages((prev) => {
            const newMap = new Map(prev)
            newQuestions.forEach((q: Question) => {
              const categoryImage = categoryImageMap.get(q.category)
              if (categoryImage) {
                newMap.set(q.id, categoryImage)
              }
            })
            return newMap
          })
        }).catch((e) => {
          console.warn('[画像取得一括エラー]', e)
          // エラーは無視
        })
      } else {
        // 質問が空の場合はリトライ
        if (retryCount < 3) {
          console.warn(`[質問が空] リトライ: ${retryCount + 1}`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
          return loadNextQuestions(retryCount + 1)
        }
        throw new Error('質問が生成されませんでした')
      }
    } catch (e: any) {
      console.error('[loadNextQuestions] error:', e)
      setError(e.message || 'エラーが発生しました')
      // エラー時も質問キューが空でない場合は続行
      if (questionQueue.length === 0) {
        // 質問キューが空の場合はリトライ
        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          return loadNextQuestions(retryCount + 1)
        }
      }
    } finally {
      setIsGeneratingQuestion(false)
    }
  }, [sessionId, answers, isGeneratingQuestion, questionQueue.length])

  // 「考え中」表示は、次の質問がキューに入ってから消す（ラグ防止）
  useEffect(() => {
    if (isTransitioningQuestion && questionQueue.length > 0) {
      // 1フレーム待ってから消す（描画のラグを減らす）
      const id = requestAnimationFrame(() => setIsTransitioningQuestion(false))
      return () => cancelAnimationFrame(id)
    }
  }, [isTransitioningQuestion, questionQueue.length])

  // スワイプ処理
  const handleSwipe = async (decision: SwipeDecision, question: Question) => {
    if (!question || !sessionId || decision === 'hold') return

    try {
      const answer: Answer = {
        questionId: question.id,
        question: question.question,
        answer: decision === 'yes' ? 'yes' : 'no',
        category: question.category,
      }

      const newAnswers = [...answers, answer]
      setAnswers(newAnswers)

      // 次の質問生成が必要かを先に判定（setStateの非同期でラグらないように）
      const remaining = Math.max(0, questionQueue.length - 1)
      const shouldGenerateNext = remaining <= 2 && !isGeneratingQuestion
      if (shouldGenerateNext) {
        setIsTransitioningQuestion(true)
        setIsGeneratingQuestion(true) // 一瞬の空白防止（loadNextQuestions側でもtrueになる）
      }

      // 現在の質問をキューから削除
      setQuestionQueue((prev) => prev.filter((q) => q.id !== question.id))

      // 進捗を更新（完了まで100%に到達しないように、適度な進捗を表示）
      // 完了フラグが出るまで実際の進捗は不明なので、回答数に基づいて進捗を更新
      const estimatedProgress = Math.min(95, (newAnswers.length / Math.max(1, newAnswers.length + 3)) * 100)
      setProgress(estimatedProgress)

      // 残り1-2枚になったら次のバッチを生成
      if (shouldGenerateNext) {
        await loadNextQuestions()
      }
    } catch (e: any) {
      console.error('[handleSwipe] error:', e)
      setError(e.message || 'スワイプ処理中にエラーが発生しました')
    }
  }

  // 初期ロード時にも次のバッチを生成
  useEffect(() => {
    if (step === 'swipe' && questionQueue.length <= 1 && !isGeneratingQuestion && sessionId) {
      loadNextQuestions()
    }
  }, [step, questionQueue.length, isGeneratingQuestion, sessionId, loadNextQuestions])

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
          primaryInfoText,
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Skyscanner風のダークブルー背景（高級感・信頼感） */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/30 via-transparent to-transparent" />
      
      {/* 微細なパターン */}
      <div className="fixed inset-0 pointer-events-none opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
        {/* ヘッダー */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
            スワイプ記事作成
          </h1>
          <p className="text-blue-100 font-medium text-sm sm:text-base">
            カードをめくって答える感覚で進めます。右=YES、左=NO。
          </p>
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
                placeholder="例: SEO対策, マーケティング戦略, おすすめ化粧品, 通信料金比較, AIライティングツール, 記事作成ツール, コンテンツマーケティング, 転職サイト比較, 投資信託ランキング, ダイエット方法"
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
            <div className="grid grid-cols-12 gap-6 items-center">
              {/* NO領域（固定・重なりなし） */}
              <div className="hidden xl:flex col-span-2 items-center justify-center">
                <div className="w-full rounded-2xl border border-slate-700/30 bg-white/10 backdrop-blur-sm shadow-sm p-4">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-white leading-none">NO</div>
                    <div className="mt-2 text-xs font-medium text-slate-300">左にスワイプ</div>
                  </div>
                </div>
              </div>

              {/* カード領域 */}
              <div className="col-span-12 xl:col-span-8">
                <div className="relative h-[520px] sm:h-[600px] md:h-[680px] mb-20 sm:mb-8 z-10 flex items-start justify-center pt-2 sm:pt-4">
                  {/* 生成中オーバーレイ（カードの上で"考え中"を演出） */}
                  <AnimatePresence>
                    {showThinking && (
                      <motion.div
                        className="absolute inset-0 z-30 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div
                          initial={{ scale: 0.95, y: 20, opacity: 0 }}
                          animate={{ scale: 1, y: 0, opacity: 1 }}
                          exit={{ scale: 0.95, y: 20, opacity: 0 }}
                          className="relative w-[min(360px,88%)] sm:w-[min(440px,90%)] rounded-2xl sm:rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-4 sm:p-6 overflow-hidden"
                        >
                          {/* 上部アクセント */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                          
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-slate-900 font-bold text-sm sm:text-base">次の質問を考えています…</p>
                              <p className="text-slate-600 font-medium text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                                {thinkingMessages[thinkingIdx % thinkingMessages.length]}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 sm:mt-5">
                            <div className="h-2 sm:h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                                initial={{ x: '-40%' }}
                                animate={{ x: ['-40%', '110%'] }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                style={{ width: '45%' }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {questionQueue.length > 0 ? (
                    <TinderSwipeCard
                      key={questionQueue[0].id}
                      question={questionQueue[0]}
                      onSwipe={(decision) => handleSwipe(decision, questionQueue[0])}
                      index={0}
                      total={questionQueue.length}
                      questionImage={questionImages.get(questionQueue[0].id)}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-8 sm:p-12 text-center flex items-center justify-center">
                      <p className="text-slate-500 font-bold text-sm sm:text-base">準備中…</p>
                    </div>
                  )}
                </div>
              </div>

              {/* YES領域（固定・重なりなし） */}
              <div className="hidden xl:flex col-span-2 items-center justify-center">
                <div className="w-full rounded-2xl border border-slate-700/30 bg-white/10 backdrop-blur-sm shadow-sm p-4">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-white leading-none">YES</div>
                    <div className="mt-2 text-xs font-medium text-slate-300">右にスワイプ</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 進捗バー（下部） */}
            <div className="fixed bottom-0 left-0 sm:left-64 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 shadow-lg z-50 p-3 sm:p-4">
              <div className="max-w-5xl mx-auto">
                <div className="w-full h-4 sm:h-6 bg-slate-800/50 rounded-full overflow-hidden shadow-inner border border-slate-700/30">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full shadow-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                {isGeneratingQuestion && (
                  <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3 text-xs sm:text-sm text-slate-300">
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    <span className="font-medium">次の質問を生成中...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ステップ3: 最終確認（リッチな完了UI） */}
        {step === 'confirm' && finalData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-3xl shadow-2xl p-8 border-2 border-emerald-100"
          >
            {/* 完了時のリッチな画像表示 */}
            {celebrationImage && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mb-8 rounded-2xl overflow-hidden shadow-2xl"
              >
                <img
                  src={`data:${celebrationImage.mimeType};base64,${celebrationImage.imageBase64}`}
                  alt="完成しました"
                  className="w-full h-auto rounded-2xl"
                />
              </motion.div>
            )}
            
            {/* 完了メッセージ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-8"
            >
              <h2 className="text-4xl font-black text-gray-900 mb-3 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                完成しました！
              </h2>
              <p className="text-xl font-bold text-gray-700 mb-2">ありがとうございました</p>
              <p className="text-sm text-gray-600">質問へのご回答、お疲れ様でした</p>
            </motion.div>

            {/* 回答の要約プレビュー */}
            {answers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-8"
              >
                <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                  <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <h4 className="text-sm font-black text-gray-800">あなたの回答サマリー</h4>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <ThumbsUp className="w-4 h-4" />
                          {finalData.yesCount || answers.filter(a => a.answer === 'yes').length}件
                        </span>
                        <span className="flex items-center gap-1 text-rose-500">
                          <ThumbsDown className="w-4 h-4" />
                          {finalData.noCount || answers.filter(a => a.answer === 'no').length}件
                        </span>
                        <span className="text-gray-500">
                          計{finalData.totalAnswers || answers.length}問
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 max-h-[300px] overflow-auto">
                    {/* カテゴリ別に回答を表示 */}
                    {(() => {
                      const categories = new Map<string, Answer[]>()
                      answers.forEach(a => {
                        const cat = a.category || '一般'
                        if (!categories.has(cat)) categories.set(cat, [])
                        categories.get(cat)!.push(a)
                      })
                      return Array.from(categories.entries()).map(([category, catAnswers]) => (
                        <div key={category} className="mb-4 last:mb-0">
                          <h5 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            {category}
                          </h5>
                          <div className="space-y-2">
                            {catAnswers.map((a, idx) => (
                              <div
                                key={`${a.questionId}-${idx}`}
                                className={`flex items-start gap-3 p-3 rounded-xl ${
                                  a.answer === 'yes' 
                                    ? 'bg-emerald-50 border border-emerald-100' 
                                    : 'bg-rose-50 border border-rose-100'
                                }`}
                              >
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                  a.answer === 'yes' ? 'bg-emerald-500' : 'bg-rose-400'
                                }`}>
                                  {a.answer === 'yes' ? (
                                    <Check className="w-4 h-4 text-white" />
                                  ) : (
                                    <X className="w-4 h-4 text-white" />
                                  )}
                                </div>
                                <p className="text-sm font-medium text-gray-700 flex-1">{a.question}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </motion.div>
            )}
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-xl font-black text-gray-900 mb-6">最終確認</h3>

              <div className="space-y-6 mb-8">
              {/* タイトル選択（6種類から選択） */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700">記事タイトル <span className="text-rose-500">*</span></label>
                  {finalData.titleCandidates && finalData.titleCandidates.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsGeneratingTitles(true)
                        try {
                          // タイトルを再生成（APIを呼び出す）
                          const res = await fetch('/api/seo/title-suggestions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              keyword: keywords,
                              summary: finalData.summary,
                              count: 6,
                            }),
                          })
                          const json = await res.json()
                          if (json.titles && Array.isArray(json.titles)) {
                            setFinalData({
                              ...finalData,
                              titleCandidates: json.titles,
                              title: json.titles[0] || finalData.title,
                            })
                            setSelectedTitleIndex(0)
                          }
                        } catch (e) {
                          console.error('タイトル再生成エラー:', e)
                        } finally {
                          setIsGeneratingTitles(false)
                        }
                      }}
                      disabled={isGeneratingTitles}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingTitles ? 'animate-spin' : ''}`} />
                      タイトル自動生成（{finalData.titleCandidates.length}）
                    </button>
                  )}
                </div>
                
                {/* 現在選択中のタイトル（編集可能） */}
                <input
                  type="text"
                  value={finalData.title}
                  onChange={(e) => setFinalData({ ...finalData, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none font-bold text-gray-900 mb-3"
                />
                
                {/* タイトル候補6種類 */}
                {finalData.titleCandidates && finalData.titleCandidates.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">💡 ボタンで候補を生成→クリックでタイトル確定（後から編集もOK）</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {finalData.titleCandidates.map((title, idx) => (
                        <button
                          key={`title-${idx}`}
                          type="button"
                          onClick={() => {
                            setFinalData({ ...finalData, title })
                            setSelectedTitleIndex(idx)
                          }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            finalData.title === title
                              ? 'border-emerald-500 bg-emerald-50 shadow-md'
                              : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {finalData.title === title && (
                              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            )}
                            <p className={`text-sm font-bold ${finalData.title === title ? 'text-emerald-700' : 'text-gray-700'}`}>
                              {title}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                  文字数目安
                  <span className="ml-2 text-[10px] font-bold text-gray-400 normal-case">
                    ({userPlan === 'GUEST' ? 'ゲスト' : userPlan === 'FREE' ? '無料' : userPlan === 'PRO' ? 'プロ' : 'エンタープライズ'}プラン: 最大{charLimit.toLocaleString()}字)
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {charPresets.map((p) => {
                    const selected = finalData.targetChars === p.value
                    const locked = p.value > charLimit
                    const requiredPlan: 'ENTERPRISE' | 'PRO' | 'FREE' | 'GUEST' =
                      p.value >= 50000
                        ? 'ENTERPRISE'
                        : p.value > 20000
                          ? 'ENTERPRISE'
                          : p.value > 10000
                            ? 'PRO'
                            : p.value > 5000
                              ? 'FREE'
                              : 'GUEST'
                    const requiredLabel =
                      requiredPlan === 'ENTERPRISE'
                        ? 'Enterpriseが必要'
                        : requiredPlan === 'PRO'
                          ? 'PROが必要'
                          : requiredPlan === 'FREE'
                            ? 'ログインが必要'
                            : 'ゲストOK'
                    const hint = locked ? `${requiredLabel}（クリックでアップグレード）` : `${p.value.toLocaleString()}字を選択`

                    return (
                      <button
                        key={`${p.label}-${p.value}`}
                        type="button"
                        onClick={() => {
                          if (locked) {
                            window.location.href = isLoggedIn ? '/seo/dashboard/plan' : '/seo/pricing'
                            return
                          }
                          setFinalData({ ...finalData, targetChars: p.value })
                        }}
                        title={hint}
                        className={`relative p-3 rounded-xl border-2 text-center transition-all overflow-hidden ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50'
                            : locked
                              ? 'border-gray-100 bg-gray-50 opacity-80 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer'
                              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        {locked && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 bg-white/35" />
                            <div className="absolute right-2 top-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900/85 text-white text-[9px] font-black shadow">
                              <Lock className="w-3 h-3" />
                              {requiredPlan === 'ENTERPRISE' ? 'Enterprise' : requiredPlan === 'PRO' ? 'PRO' : requiredPlan === 'FREE' ? 'LOGIN' : 'GUEST'}
                            </div>
                          </div>
                        )}
                        <p className={`text-sm font-black ${selected ? 'text-emerald-600' : 'text-gray-700'}`}>
                          {p.label}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{p.desc}</p>
                        {locked && (
                          <p className="text-[10px] font-black text-gray-500 mt-1">
                            {requiredLabel}
                          </p>
                        )}
                      </button>
                    )
                  })}
                  {/* プランアップグレード誘導 */}
                  {userPlan !== 'ENTERPRISE' && (
                    <Link href="/seo/pricing" className="block">
                      <div className="p-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer">
                        <div className="flex items-center justify-center gap-1 text-sm font-black text-gray-400">
                          <Lock className="w-3.5 h-3.5" />
                          <span>もっと長く</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">プランをアップグレード</p>
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {finalData.summary && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    質問回答から得た情報と記事の方向性
                  </label>
                  <div className="w-full border border-white/70 rounded-2xl bg-white/85 backdrop-blur-sm shadow-[0_18px_50px_rgba(0,0,0,0.10)] overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                      <div className="text-xs font-black text-gray-700 tracking-wider">プレビュー</div>
                      <div className="text-[11px] font-bold text-gray-500">読みやすい表示に整形しました</div>
                    </div>
                    <div className="px-5 py-5 max-h-[420px] overflow-auto">
                      <MarkdownPreview markdown={summaryMarkdown} />
                    </div>
                  </div>
                </div>
              )}

              {/* 一次情報（経験・訴求ポイント） */}
              <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-white p-6 shadow-lg shadow-indigo-500/10">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black tracking-widest">
                        重要
                      </span>
                      <label className="text-xs font-black text-blue-800 uppercase tracking-widest">
                        一次情報（経験・訴求ポイント）
                      </label>
                    </div>
                    <p className="mt-1 text-xs font-bold text-blue-700">
                      ここが入るほど「あなたにしか書けない記事」になり、差別化できます。
                    </p>
                  </div>
                  <div className="text-[10px] font-black text-blue-700/80 bg-white/70 border border-blue-100 px-3 py-2 rounded-2xl">
                    例：実体験 / 数字 / 失敗談 / 現場の工夫 / 比較の結論
                  </div>
                </div>

                <textarea
                  value={primaryInfoText}
                  onChange={(e) => setPrimaryInfoText(e.target.value)}
                  placeholder="例：実体験、現場の失敗談、数字、独自の主張、比較の結論、読者に必ず伝えたいこと…"
                  rows={5}
                  className="mt-4 w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-200 text-slate-900 font-bold text-sm placeholder:text-slate-300 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200/40 transition-all resize-none"
                />
                <p className="mt-2 text-xs font-bold text-indigo-700">
                  ✨ 入力した一次情報は本文生成に反映されます
                </p>
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
          </motion.div>
        )}
      </div>
    </div>
  )
}
