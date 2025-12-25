'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  RefreshCcw,
  Play,
  Pause,
  ExternalLink,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Brain,
  PenTool,
  Layers,
  Image as ImageIcon,
  Rocket,
  PartyPopper,
} from 'lucide-react'
import { CompletionModal } from '@seo/components/CompletionModal'
import { patchSeoClientSettings, readSeoClientSettings } from '@seo/lib/clientSettings'

type SeoSection = {
  id: string
  index: number
  headingPath?: string | null
  plannedChars: number
  status: string
  content?: string | null
  consistency?: string | null
}

type SeoJob = {
  id: string
  status: string
  step: string
  progress: number
  error?: string | null
  articleId: string
  article: { id: string; title: string; outline?: string | null; targetChars: number }
  sections: SeoSection[]
}

// ステップ情報（アイコン・色・ラベル）
const STEPS = [
  { key: 'init', label: '準備中', icon: Zap, color: 'gray' },
  { key: 'outline', label: '構成生成', icon: Brain, color: 'purple' },
  { key: 'sections', label: '本文執筆', icon: PenTool, color: 'blue' },
  { key: 'integrate', label: '記事統合', icon: Layers, color: 'indigo' },
  { key: 'media', label: '図解生成', icon: ImageIcon, color: 'orange' },
  { key: 'done', label: '完了', icon: Rocket, color: 'green' },
]

// ジョブステータスを日本語に変換
const JOB_STATUS_LABELS: Record<string, string> = {
  pending: '待機中',
  running: '実行中',
  paused: '一時停止中',
  done: '完了',
  error: 'エラー',
  cancelled: 'キャンセル済み',
}

// ステップ名を日本語に変換
const STEP_LABELS: Record<string, string> = {
  init: '準備中',
  outline: '構成生成',
  sections: '本文執筆',
  integrate: '記事統合',
  media: '図解生成',
  done: '完了',
  OUTLINE: '構成生成',
  SECTIONS: '本文執筆',
  INTEGRATE: '記事統合',
  MEDIA: '図解生成',
  DONE: '完了',
  cmp_ref: '参考記事解析',
  cmp_candidates: '候補収集',
  cmp_crawl: 'サイト巡回',
  cmp_extract: '情報抽出',
  cmp_sources: '出典整形',
  cmp_tables: '比較表生成',
  cmp_outline: '章立て生成',
  cmp_polish: '校正中',
}

// セクションステータスを日本語に変換
const SECTION_STATUS_LABELS: Record<string, string> = {
  pending: '未生成',
  generating: '生成中',
  generated: '生成済み',
  reviewed: 'レビュー済',
  error: 'エラー',
}

// ワクワク Tips
const TIPS = [
  '💡 構成は後から自由に編集できます',
  '🎨 図解・サムネも自動生成されます',
  '📊 SEOに最適化された見出し構成を生成中...',
  '✨ 高品質なコンテンツを目指しています',
  '🚀 1万字以上の記事も対応可能です',
  '📝 各セクションは個別に再生成できます',
]

export default function SeoJobPage() {
  const params = useParams<{ id: string }>()
  const jobId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const [job, setJob] = useState<SeoJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionPopupEnabled, setCompletionPopupEnabled] = useState(true)
  const prevStatusRef = useRef<string | null>(null)
  const dontShowAgainRef = useRef(false)
  const [tipIndex, setTipIndex] = useState(0)

  const reviewedCount = useMemo(
    () => (job?.sections || []).filter((s) => s.status === 'reviewed' || s.status === 'generated').length,
    [job]
  )

  // 現在のステップインデックス
  const currentStepIndex = useMemo(() => {
    if (!job) return 0
    const idx = STEPS.findIndex((s) => s.key === job.step.toLowerCase())
    return idx >= 0 ? idx : 0
  }, [job])

  // ポーリング中かどうかのref（再レンダリングを避けるため）
  const isPollingRef = useRef(false)
  const jobRef = useRef<SeoJob | null>(null)

  // jobが更新されたらrefも更新
  useEffect(() => {
    jobRef.current = job
  }, [job])

  // Tips を回転表示
  useEffect(() => {
    if (job?.status === 'done') return
    const t = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length)
    }, 5000)
    return () => clearInterval(t)
  }, [job?.status])

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading === true

    // ポーリング中の二重呼び出しを防止
    if (!showLoading && isPollingRef.current) return
    isPollingRef.current = true

    if (showLoading) setLoading(true)
    setLoadError(null)
    try {
      const controller = new AbortController()
      const timeoutMs = 12000
      const t = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(`/api/seo/jobs/${jobId}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(t)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `API Error: ${res.status}`)
      }

      const newJob = json.job || null
      if (newJob) {
        setJob(newJob)
      }
    } catch (e: any) {
      if (showLoading || !jobRef.current) setJob(null)
      const msg =
        e?.name === 'AbortError'
          ? '読み込みがタイムアウトしました。再読み込みしてください。'
          : e?.message || '読み込みに失敗しました'
      setLoadError(msg)
    }
    if (showLoading) setLoading(false)
    isPollingRef.current = false
  }, [jobId])

  const advanceOnce = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      setActionError(null)
      if (job?.status === 'paused') {
        await fetch(`/api/seo/jobs/${jobId}/resume`, { method: 'POST' })
      }
      const res = await fetch(`/api/seo/jobs/${jobId}/advance`, { method: 'POST' })
      let json: any = null
      try {
        json = await res.json()
      } catch {
        // ignore
      }
      if (!res.ok || json?.success === false) {
        const msg = json?.error || `advance failed (${res.status})`
        setActionError(msg)
        setAuto(false)
        await load({ showLoading: false })
        return
      }
      await load({ showLoading: false })
    } finally {
      setBusy(false)
    }
  }, [busy, jobId, load, job?.status])

  useEffect(() => {
    load({ showLoading: true })
    const t = setInterval(() => {
      load({ showLoading: false })
    }, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    setCompletionPopupEnabled(readSeoClientSettings().completionPopupEnabled)
  }, [])

  useEffect(() => {
    const cur = job?.status || null
    const prev = prevStatusRef.current
    prevStatusRef.current = cur
    if (!job) return
    if (!completionPopupEnabled) return
    if (cur !== 'done') return
    if (!prev || prev === 'done') return

    try {
      const key = `doyaSeo.completionPopup.shown.job.${jobId}`
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // ignore
    }

    setCompletionOpen(true)
  }, [job, job?.status, completionPopupEnabled, jobId])

  useEffect(() => {
    const a = searchParams.get('auto')
    if (a === '1') setAuto(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!auto) return
    if (!job) return
    if (job.status === 'done' || job.status === 'error') return
    const t = setTimeout(() => {
      advanceOnce()
    }, 700)
    return () => clearTimeout(t)
  }, [auto, job, advanceOnce])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
          <p className="text-gray-500 font-bold">読み込み中...</p>
        </motion.div>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 text-center">読み込みに失敗しました</h2>
          <p className="text-sm text-gray-500 mt-3 text-center">{loadError || '不明なエラー'}</p>
          <button
            className="mt-6 w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-colors"
            onClick={() => {
              setLoading(true)
              load({ showLoading: true })
            }}
          >
            再読み込み
          </button>
        </motion.div>
      </main>
    )
  }

  const isRunning = job.status === 'running'
  const isDone = job.status === 'done'
  const isPaused = job.status === 'paused'
  const isError = job.status === 'error'

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white py-8 px-4">
      <CompletionModal
        open={completionOpen}
        title={job.article.title}
        subtitle="図解・サムネも生成されています。プレビューを確認しましょう。"
        primaryLabel="記事を見る"
        onPrimary={() => router.push(`/seo/articles/${job.articleId}`)}
        onClose={() => {
          if (dontShowAgainRef.current) {
            const next = patchSeoClientSettings({ completionPopupEnabled: false })
            setCompletionPopupEnabled(next.completionPopupEnabled)
          }
          dontShowAgainRef.current = false
          setCompletionOpen(false)
        }}
        onDontShowAgainChange={(v) => {
          dontShowAgainRef.current = v
        }}
      />

      <div className="max-w-5xl mx-auto">
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-100 text-gray-600 text-xs font-black mb-4 shadow-sm">
            <Sparkles className="w-4 h-4" />
            AI記事生成中
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">
            {job.article.title}
          </h1>
          <p className="text-gray-500 mt-3 text-sm font-bold">
            目標: {job.article.targetChars.toLocaleString()}文字
          </p>
        </motion.div>

        {/* メインカード */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-xl shadow-blue-500/5"
        >
          {/* ステータスバー */}
          <div className={`h-2 ${isDone ? 'bg-gradient-to-r from-green-400 to-emerald-500' : isError ? 'bg-gradient-to-r from-red-400 to-rose-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'}`}>
            {isRunning && (
              <motion.div
                className="h-full bg-white/35"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                style={{ width: '50%' }}
              />
            )}
          </div>

          {/* コンテンツ */}
          <div className="p-6 sm:p-8 lg:p-10">
            {/* ステップ進捗 */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                {STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex
                  const isCompleted = idx < currentStepIndex
                  const Icon = step.icon

                  return (
                    <motion.div
                      key={step.key}
                      className={`flex-1 min-w-[92px] flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border ${
                        isActive
                          ? 'bg-blue-50 border-blue-100 scale-[1.03]'
                          : isCompleted
                          ? 'bg-gray-50 border-gray-100'
                          : 'bg-white border-transparent opacity-70'
                      }`}
                      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ repeat: isActive && isRunning ? Infinity : 0, duration: 2 }}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isCompleted
                            ? 'bg-emerald-50'
                            : isActive
                            ? 'bg-blue-100/70'
                            : 'bg-gray-50'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        ) : isActive && isRunning ? (
                          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        ) : (
                          <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <span className={`text-[10px] sm:text-xs font-black ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.label}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* 進捗バー */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm font-black">進捗</span>
                <span className="text-gray-900 font-black text-lg">{job.progress}%</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Tips（生成中のみ） */}
            {isRunning && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={tipIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center py-4 px-6 rounded-2xl bg-gray-50 border border-gray-100 mb-8"
                >
                  <p className="text-gray-700 text-sm font-bold">{TIPS[tipIndex]}</p>
                </motion.div>
              </AnimatePresence>
            )}

            {/* アクションボタン */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black transition-all shadow-sm ${
                  isDone
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95'
                } disabled:opacity-50`}
                onClick={isDone ? () => router.push(`/seo/articles/${job.articleId}`) : advanceOnce}
                disabled={busy || (isDone ? false : job.status === 'cancelled')}
              >
                {isDone ? (
                  <>
                    <PartyPopper className="w-5 h-5" />
                    記事を見る
                  </>
                ) : busy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    {isPaused ? '再開する' : '次へ進める'}
                  </>
                )}
              </button>

              {!isDone && (
                <>
                  <button
                    className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${
                      auto
                        ? 'bg-orange-50 text-orange-700 border border-orange-100'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setAuto((v) => !v)}
                  >
                    {auto ? (
                      <>
                        <Pause className="w-4 h-4" /> 自動停止
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" /> 自動実行
                      </>
                    )}
                  </button>

                  <button
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white text-gray-700 border border-gray-200 font-bold hover:bg-gray-50 transition-all shadow-sm"
                    onClick={async () => {
                      setActionError(null)
                      try {
                        if (isPaused) {
                          await fetch(`/api/seo/jobs/${jobId}/resume`, { method: 'POST' })
                        } else {
                          await fetch(`/api/seo/jobs/${jobId}/pause`, { method: 'POST' })
                        }
                        await load({ showLoading: false })
                      } catch (e: any) {
                        setActionError(e?.message || '失敗しました')
                      }
                    }}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'サーバ再開' : 'サーバ停止'}
                  </button>

                  <button
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 border border-red-100 font-bold hover:bg-red-100/60 transition-all"
                    onClick={async () => {
                      if (!confirm('ジョブをキャンセルしますか？（途中成果物は残ります）')) return
                      setActionError(null)
                      try {
                        await fetch(`/api/seo/jobs/${jobId}/cancel`, { method: 'POST' })
                        await load({ showLoading: false })
                        setAuto(false)
                      } catch (e: any) {
                        setActionError(e?.message || '失敗しました')
                      }
                    }}
                  >
                    キャンセル
                  </button>
                </>
              )}

              <button
                className="p-3 rounded-xl bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                onClick={() => load({ showLoading: true })}
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>

            {/* エラー表示 */}
            {(job.error || actionError) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl bg-red-50 border border-red-100 mb-8"
              >
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-red-700">エラーが発生しました</p>
                    <pre className="text-xs text-red-700/80 whitespace-pre-wrap mt-2">
                      {job.error || actionError}
                    </pre>
                    <button
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-black hover:bg-gray-800 disabled:opacity-60"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          setActionError(null)
                          const res = await fetch(`/api/seo/jobs/${jobId}/reset`, { method: 'POST' })
                          const json = await res.json().catch(() => ({}))
                          if (!res.ok || json?.success === false) {
                            throw new Error(json?.error || `reset failed (${res.status})`)
                          }
                          setAuto(true)
                          await load({ showLoading: true })
                          await fetch(`/api/seo/jobs/${jobId}/advance`, { method: 'POST' }).catch(() => {})
                          await load({ showLoading: false })
                        } catch (e: any) {
                          setActionError(e?.message || 'リセットに失敗しました')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      <RefreshCcw className="w-4 h-4" />
                      リセットして再開
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 完了メッセージ */}
            {isDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 rounded-3xl bg-gradient-to-b from-emerald-50 to-white border border-emerald-100 text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-emerald-100 flex items-center justify-center">
                  <PartyPopper className="w-10 h-10 text-emerald-700" />
                </div>
                <h2 className="text-2xl font-black text-gray-900">🎉 記事が完成しました！</h2>
                <p className="text-gray-600 mt-2 font-bold">
                  プレビュー・編集・エクスポートが可能です
                </p>
                <button
                  className="mt-6 px-8 py-4 rounded-xl bg-gray-900 text-white font-black hover:bg-gray-800 transition-colors"
                  onClick={() => router.push(`/seo/articles/${job.articleId}`)}
                >
                  記事ページを開く <ArrowRight className="inline w-5 h-5 ml-2" />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* セクション進捗（生成中・完了時） */}
        {!isDone && job.sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              セクション進捗 ({reviewedCount}/{job.sections.length})
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {job.sections.map((s, idx) => {
                const isGenerating = s.status === 'generating'
                const isComplete = s.status === 'reviewed' || s.status === 'generated'
                const isErr = s.status === 'error'

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-2xl border transition-all shadow-sm ${
                      isGenerating
                        ? 'bg-blue-50 border-blue-100'
                        : isComplete
                        ? 'bg-emerald-50 border-emerald-100'
                        : isErr
                        ? 'bg-red-50 border-red-100'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isGenerating
                            ? 'bg-blue-100'
                            : isComplete
                            ? 'bg-emerald-100'
                            : isErr
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        ) : isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : isErr ? (
                          <XCircle className="w-4 h-4 text-red-700" />
                        ) : (
                          <span className="text-xs font-black text-gray-500">{s.index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">
                          {s.headingPath || `セクション ${s.index + 1}`}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1 font-bold">
                          {SECTION_STATUS_LABELS[s.status] || s.status} · {s.plannedChars}字
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* フッターリンク */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <Link
            href={`/seo/articles/${job.articleId}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-bold transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            記事ページを開く
          </Link>
        </motion.div>
      </div>
    </main>
  )
}
