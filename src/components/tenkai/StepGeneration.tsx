'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// Types
// ============================================
interface PlatformProgress {
  platform: string
  status: 'queued' | 'generating' | 'completed' | 'failed'
  progress: number
  content: string
}

interface StepGenerationProps {
  projectId: string
  platforms: string[]
  brandVoiceId: string | null
  customInstructions: string
  onComplete: () => void
}

// ============================================
// プラットフォームアイコンマッピング
// ============================================
const PLATFORM_META: Record<string, { icon: string; label: string }> = {
  note: { icon: 'edit_note', label: 'note' },
  blog: { icon: 'article', label: 'Blog' },
  x: { icon: 'alternate_email', label: 'X' },
  instagram: { icon: 'camera_alt', label: 'Instagram' },
  line: { icon: 'chat_bubble', label: 'LINE' },
  facebook: { icon: 'business', label: 'Facebook' },
  linkedin: { icon: 'work', label: 'LinkedIn' },
  newsletter: { icon: 'mail', label: 'メルマガ' },
  press_release: { icon: 'push_pin', label: 'プレスリリース' },
}

// ============================================
// StepGeneration コンポーネント
// ============================================
export default function StepGeneration({
  projectId,
  platforms,
  brandVoiceId,
  customInstructions,
  onComplete,
}: StepGenerationProps) {
  const [platformProgress, setPlatformProgress] = useState<PlatformProgress[]>(() =>
    platforms.map((p) => ({
      platform: p,
      status: 'queued',
      progress: 0,
      content: '',
    }))
  )
  const [currentPlatform, setCurrentPlatform] = useState<string | null>(null)
  const [displayedContent, setDisplayedContent] = useState('')
  const [overallProgress, setOverallProgress] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // ============================================
  // SSE接続（POSTベースのfetch + ReadableStream）
  // ============================================
  useEffect(() => {
    if (isCancelled) return

    const abortController = new AbortController()
    abortRef.current = abortController

    async function startGeneration() {
      try {
        const res = await fetch('/api/tenkai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            platforms,
            brandVoiceId: brandVoiceId || undefined,
            customInstructions: customInstructions || undefined,
          }),
          signal: abortController.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error('生成の開始に失敗しました')
        }

        setIsConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.replace('data: ', '').trim()
            if (raw === '[DONE]') {
              setIsConnected(false)
              setOverallProgress(100)
              continue
            }

            try {
              const event = JSON.parse(raw)

              if (event.type === 'generation_start') {
                setCurrentPlatform(event.platform)
                setPlatformProgress((prev) =>
                  prev.map((p) =>
                    p.platform === event.platform
                      ? { ...p, status: 'generating', progress: 0, content: '' }
                      : p
                  )
                )
                setDisplayedContent('')
              } else if (event.type === 'generation_complete') {
                setPlatformProgress((prev) =>
                  prev.map((p) =>
                    p.platform === event.platform
                      ? { ...p, status: 'completed', progress: 100 }
                      : p
                  )
                )
              } else if (event.type === 'generation_error') {
                setPlatformProgress((prev) =>
                  prev.map((p) =>
                    p.platform === event.platform
                      ? { ...p, status: 'failed', progress: 0 }
                      : p
                  )
                )
              } else if (event.type === 'all_complete') {
                setIsConnected(false)
                setOverallProgress(100)
              }
            } catch {
              // JSON parse error — skip
            }
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error('[StepGeneration] SSE error:', e.message)
        }
        setIsConnected(false)
      }
    }

    startGeneration()

    return () => {
      abortController.abort()
    }
  }, [projectId, platforms, brandVoiceId, customInstructions, isCancelled])

  // オートスクロール
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [displayedContent])

  // 全体進捗の計算
  useEffect(() => {
    const completed = platformProgress.filter(
      (p) => p.status === 'completed' || p.status === 'failed'
    ).length
    const total = platformProgress.length
    if (total > 0) {
      setOverallProgress(Math.round((completed / total) * 100))
    }
  }, [platformProgress])

  // すべて完了チェック
  const allDone = platformProgress.every(
    (p) => p.status === 'completed' || p.status === 'failed'
  )

  // キャンセル処理
  const handleCancel = useCallback(() => {
    setIsCancelled(true)
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setIsConnected(false)
  }, [])

  // ============================================
  // ステータスアイコン
  // ============================================
  const renderStatusIcon = (status: PlatformProgress['status']) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-500 text-sm">check</span>
          </div>
        )
      case 'generating':
        return (
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <motion.span
              className="material-symbols-outlined text-blue-500 text-sm"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              progress_activity
            </motion.span>
          </div>
        )
      case 'failed':
        return (
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-sm">close</span>
          </div>
        )
      case 'queued':
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400 text-sm">hourglass_empty</span>
          </div>
        )
    }
  }

  // ============================================
  // メインレンダー
  // ============================================
  return (
    <div>
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">コンテンツ生成中</h2>
        <p className="text-slate-500">
          {allDone
            ? 'すべてのコンテンツが生成されました'
            : 'AIがプラットフォームごとにコンテンツを生成しています'}
        </p>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
        {/* ========== 左サイドバー: プラットフォームリスト ========== */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              プラットフォーム
            </p>
            <div className="space-y-1">
              {platformProgress.map((pp) => {
                const meta = PLATFORM_META[pp.platform] || {
                  icon: 'web',
                  label: pp.platform,
                }
                return (
                  <div
                    key={pp.platform}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      currentPlatform === pp.platform && pp.status === 'generating'
                        ? 'bg-blue-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {renderStatusIcon(pp.status)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          pp.status === 'generating'
                            ? 'text-blue-600'
                            : pp.status === 'completed'
                            ? 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {meta.label}
                      </p>
                      {pp.status === 'generating' && (
                        <div className="w-full h-1 bg-blue-200 rounded-full overflow-hidden mt-1">
                          <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            animate={{ width: `${pp.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ========== メインエリア: ライブプレビュー ========== */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* プレビューヘッダー */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              {currentPlatform && (
                <>
                  <span
                    className={`material-symbols-outlined text-xl ${
                      allDone ? 'text-emerald-500' : 'text-blue-500'
                    }`}
                  >
                    {PLATFORM_META[currentPlatform]?.icon || 'web'}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {PLATFORM_META[currentPlatform]?.label || currentPlatform}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {allDone ? '生成完了' : 'リアルタイムプレビュー'}
                    </p>
                  </div>
                </>
              )}
              {!currentPlatform && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">pending</span>
                  <p className="text-sm text-slate-400">生成待機中...</p>
                </div>
              )}
            </div>

            {/* コンテンツ */}
            <div
              ref={contentRef}
              className="p-6 h-[400px] overflow-y-auto"
            >
              <AnimatePresence mode="wait">
                {displayedContent ? (
                  <motion.div
                    key={currentPlatform}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-sm max-w-none"
                  >
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                      {displayedContent}
                      {/* タイピングカーソル */}
                      {!allDone && currentPlatform && (
                        <motion.span
                          className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 align-text-bottom"
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        />
                      )}
                    </pre>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-slate-400"
                  >
                    <motion.span
                      className="material-symbols-outlined text-5xl mb-4"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      auto_awesome
                    </motion.span>
                    <p className="text-sm">コンテンツが生成されるとここに表示されます</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ========== 全体進捗バー ========== */}
      <div className="max-w-5xl mx-auto mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">trending_up</span>
              <span className="text-sm font-bold text-slate-900">全体進捗</span>
            </div>
            <span className="text-sm font-bold text-blue-600">{overallProgress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                allDone
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between mt-4">
            {!allDone && !isCancelled && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">cancel</span>
                すべてキャンセル
              </button>
            )}
            {isCancelled && (
              <p className="text-sm text-red-500 font-medium">生成がキャンセルされました</p>
            )}
            {allDone && (
              <button
                onClick={onComplete}
                className="ml-auto flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
              >
                成果物を確認
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
