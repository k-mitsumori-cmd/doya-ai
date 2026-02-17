'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// Types
// ============================================
interface AnalysisData {
  summary: string
  keywords: string[]
  hashtags: string[]
  topicCategory: string
  tone: string
  sentiment: string
}

interface StepAnalysisProps {
  projectId: string
  onComplete: (data: AnalysisData) => void
}

// ============================================
// StepAnalysis コンポーネント
// ============================================
export default function StepAnalysis({ projectId, onComplete }: StepAnalysisProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ============================================
  // 分析実行
  // ============================================
  const runAnalysis = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setProgress(0)

    // 前回のintervalが残っていたらクリア
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    // プログレスアニメーション
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          return 90
        }
        return prev + Math.random() * 15
      })
    }, 500)

    try {
      const res = await fetch('/api/tenkai/content/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || '分析に失敗しました')
      }

      const data = await res.json()
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(100)

      const a = data.analysis || data
      const result: AnalysisData = {
        summary: a.summary || a.summary_short || '',
        keywords: a.keywords || [],
        hashtags: a.hashtags || [],
        topicCategory: a.topicCategory || a.topic_category || '',
        tone: a.tone || a.detected_tone || '',
        sentiment: a.sentiment || '',
      }

      setAnalysisData(result)
    } catch (err: unknown) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setError(err instanceof Error ? err.message : '分析中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // マウント時に自動実行 + アンマウント時にintervalクリーンアップ
  useEffect(() => {
    runAnalysis()
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [runAnalysis])

  // ============================================
  // ローディングUI
  // ============================================
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-16">
      {/* AI処理アニメーション */}
      <div className="relative w-32 h-32 mb-8">
        {/* 外側の回転リング */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-blue-200"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{ borderTopColor: '#3B82F6' }}
        />
        {/* 内側のパルス */}
        <motion.div
          className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="material-symbols-outlined text-4xl text-white">
            auto_awesome
          </span>
        </motion.div>
        {/* 散らばるドット */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-blue-400"
            style={{
              top: '50%',
              left: '50%',
            }}
            animate={{
              x: [0, Math.cos((i * 60 * Math.PI) / 180) * 60, 0],
              y: [0, Math.sin((i * 60 * Math.PI) / 180) * 60, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <h3 className="text-lg font-bold text-slate-900 mb-2">AIがコンテンツを分析中...</h3>
      <p className="text-sm text-slate-500 mb-6">キーワード抽出、トーン分析、カテゴリ判定を実行しています</p>

      {/* プログレスバー */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">分析進捗</span>
          <span className="text-xs font-bold text-blue-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  )

  // ============================================
  // 分析結果UI
  // ============================================
  const renderResults = () => {
    if (!analysisData) return null

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* サマリー */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-blue-500">summarize</span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">要約</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{analysisData.summary}</p>
        </div>

        {/* キーワード + ハッシュタグ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-emerald-500">key</span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">キーワード</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysisData.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-blue-500">tag</span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">ハッシュタグ</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysisData.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* カテゴリ + トーン + 感情 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
            <span className="material-symbols-outlined text-2xl text-purple-500 mb-2">category</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">トピックカテゴリ</p>
            <p className="text-sm font-bold text-slate-900">{analysisData.topicCategory}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
            <span className="material-symbols-outlined text-2xl text-amber-500 mb-2">mic</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">トーン</p>
            <p className="text-sm font-bold text-slate-900">{analysisData.tone}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
            <span className="material-symbols-outlined text-2xl text-rose-500 mb-2">sentiment_satisfied</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">センチメント</p>
            <p className="text-sm font-bold text-slate-900">{analysisData.sentiment}</p>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={runAnalysis}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            分析を再実行
          </button>

          <button
            onClick={() => onComplete(analysisData)}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
          >
            分析結果を承認
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>
      </motion.div>
    )
  }

  // ============================================
  // メインレンダー
  // ============================================
  return (
    <div>
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">AI分析</h2>
        <p className="text-slate-500">コンテンツの特徴をAIが自動的に分析します</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {isLoading && renderLoading()}
          {!isLoading && !error && renderResults()}
        </AnimatePresence>

        {/* エラー */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-red-500">error</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">分析に失敗しました</h3>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <button
              onClick={runAnalysis}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              再試行
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
