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
  Clock,
  Hourglass,
  Timer,
  Brain,
  PenTool,
  Layers,
  Image as ImageIcon,
  Rocket,
  PartyPopper,
} from 'lucide-react'
import { CompletionModal } from '@seo/components/CompletionModal'
import { patchSeoClientSettings, readSeoClientSettings } from '@seo/lib/clientSettings'
import { AiThinkingStrip } from '@seo/components/AiThinkingStrip'

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
  createdAt?: string
  updatedAt?: string
  startedAt?: string | null
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

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function estimateTotalSeconds(targetChars: number, isComparison: boolean) {
  // 体感値ベースの目安（厳密なETAではなく“不安を減らすための目安”）
  const chars = clamp(Number(targetChars || 10000), 2000, 60000)
  const base = isComparison ? 240 : 120
  const per1k = isComparison ? 12 : 8
  const total = base + per1k * (chars / 1000)
  return clamp(total, 90, 900)
}

const STEP_PORTION: Record<string, number> = {
  init: 0.06,
  outline: 0.18,
  sections: 0.52,
  integrate: 0.12,
  media: 0.12,
  done: 0,
  // 比較記事（ざっくり）
  cmp_ref: 0.12,
  cmp_candidates: 0.12,
  cmp_crawl: 0.16,
  cmp_extract: 0.16,
  cmp_sources: 0.08,
  cmp_tables: 0.12,
  cmp_outline: 0.12,
  cmp_polish: 0.12,
}

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
  const prevStepRef = useRef<string | null>(null)
  const dontShowAgainRef = useRef(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null)
  const [stepHistory, setStepHistory] = useState<Array<{ step: string; at: number }>>([])

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

  // 経過時間（startedAtがあればそれを優先）
  useEffect(() => {
    const j = jobRef.current
    if (!j) return
    const startMs =
      (j.startedAt ? Date.parse(String(j.startedAt)) : NaN) ||
      (j.createdAt ? Date.parse(String(j.createdAt)) : NaN) ||
      NaN
    if (!Number.isFinite(startMs)) return

    const isTerminal = j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
    const endMs =
      isTerminal
        ? ((j.updatedAt ? Date.parse(String(j.updatedAt)) : NaN) || Date.now())
        : Date.now()

    // 初回計算（完了後はここで固定値にする）
    setElapsed(Math.max(0, Math.floor((endMs - startMs) / 1000)))
    if (isTerminal) return

    const t = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    }, 1000)
    return () => clearInterval(t)
  }, [job?.status, job?.startedAt, job?.createdAt, job?.updatedAt])

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
        setLastHeartbeatAt(Date.now())
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
      const j = jobRef.current
      if (j && (j.status === 'done' || j.status === 'error' || j.status === 'cancelled')) return
      load({ showLoading: false })
    }, 4000)
    return () => clearInterval(t)
  }, [jobId, load])

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

  // ステップ履歴（“動いてる感”のログ）
  useEffect(() => {
    if (!job) return
    const cur = String(job.step || '')
    const prev = prevStepRef.current
    if (cur && cur !== prev) {
      prevStepRef.current = cur
      setStepHistory((h) => [{ step: cur, at: Date.now() }, ...h].slice(0, 6))
    }
  }, [job?.step, job])

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
  const isComparison = String(job.step || '').startsWith('cmp_')
  const totalSec = estimateTotalSeconds(job.article?.targetChars || 10000, isComparison)
  const remainingSec = Math.max(0, Math.round(totalSec * (1 - (Number(job.progress || 0) / 100))))
  const remainingRange = {
    min: Math.max(0, Math.round(remainingSec * 0.6)),
    max: Math.round(remainingSec * 1.4),
  }
  const currentStepKey = String(job.step || '').toLowerCase()
  const stepPortion = STEP_PORTION[currentStepKey] ?? 0.12
  const stepExpected = Math.round(totalSec * stepPortion)
  const heartbeatAgo = lastHeartbeatAt ? Math.max(0, Math.floor((Date.now() - lastHeartbeatAt) / 1000)) : null
  const articleIdSafe = String(job.articleId || job.article?.id || '').trim()
  const articleHref = articleIdSafe ? `/seo/articles/${articleIdSafe}` : ''
  const goToArticle = () => {
    if (!articleHref) {
      setActionError('記事IDが取得できませんでした。少し待って再読み込みしてください。')
      return
    }
    router.push(articleHref)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white py-8 px-4">
      <CompletionModal
        open={completionOpen}
        title={job.article.title}
        subtitle="図解・サムネも生成されています。プレビューを確認しましょう。"
        primaryLabel="記事を見る"
        onPrimary={goToArticle}
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

          {/* 進捗（%とゲージを最上段に） */}
          <div className="max-w-4xl mx-auto mb-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-sm font-black">現在の進捗</span>
                <span className="text-gray-900 font-black text-2xl tabular-nums">{job.progress}%</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    isDone
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                      : isError
                      ? 'bg-gradient-to-r from-rose-500 to-red-500'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <div className="mt-2 text-[10px] font-bold text-gray-400 flex items-center justify-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-emerald-500' : isError ? 'bg-red-500' : isRunning ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                <span>{isDone ? '完了しました' : isError ? 'エラーが発生しました' : '進捗を更新中…'}</span>
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">
            {job.article.title}
          </h1>
          <p className="text-gray-500 mt-3 text-sm font-bold">
            目標: {job.article.targetChars.toLocaleString()}文字
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold text-gray-500">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : isError ? 'bg-red-500' : 'bg-gray-300'}`} />
              <span>状態: {JOB_STATUS_LABELS[job.status] || job.status}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm">
              <span className="text-blue-600 font-black">工程:</span>
              <span>{STEP_LABELS[job.step] || job.step}</span>
            </div>
          </div>

          {/* 時間系（見やすさ優先） */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Clock className="w-4 h-4 text-gray-500" />
                経過時間
              </div>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">
                {formatMmSs(elapsed)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-400">開始からの経過</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Hourglass className="w-4 h-4 text-blue-600" />
                {isDone ? '完了' : '残り目安'}
              </div>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">
                {isDone ? '完了' : `${formatMmSs(remainingRange.min)}〜${formatMmSs(remainingRange.max)}`}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-400">
                {isDone ? '残り目安の表示は終了しました' : '進捗から推定（目安）'}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Timer className="w-4 h-4 text-indigo-600" />
                平均所要（目安）
              </div>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">
                {formatMmSs(totalSec)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-400">
                この工程の平均:{' '}
                <span className="text-gray-700 font-black tabular-nums">
                  {isDone ? '—' : formatMmSs(stepExpected)}
                </span>
              </p>
            </div>
          </div>

          {/* 進捗（最重要：上に配置） */}
          <div className="mt-5 max-w-5xl mx-auto">
            <div className="bg-white rounded-[28px] border border-gray-100 shadow-xl shadow-blue-500/5 p-5 sm:p-6">
              {/* ステップ進捗 */}
              <div className="mb-5">
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

              {/* 心拍（進捗更新の証拠） */}
              <div className="mt-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-gray-500 font-bold">
                    <span className="inline-flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${heartbeatAgo !== null && heartbeatAgo <= 10 ? 'bg-emerald-500' : 'bg-gray-300'} ${isRunning ? 'animate-pulse' : ''}`} />
                      {isDone
                        ? '完了しました'
                        : (heartbeatAgo === null ? '通信中...' : `最終更新: ${heartbeatAgo}秒前（4秒ごとに確認）`)}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-200" />
                    <span>経過: {formatMmSs(elapsed)}</span>
                    {isRunning && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-200" />
                        <span className="text-gray-400">
                          ※「記事統合」「図解生成」は進捗が止まって見えても内部で動いていることがあります
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <AiThinkingStrip
              show={!isDone && !isError}
              title="AIが思考を巡らせています…"
              subtitle={`SEO / LLMOの観点で、工程「${STEP_LABELS[job.step] || job.step}」を最適化中です`}
              tags={['SEO', 'LLMO', '構造化', '網羅性', '読みやすさ']}
              steps={[
                '検索意図を推定して構造化',
                '上位記事を参考に網羅性を強化',
                'LLMO向けに結論・FAQを整備',
                '文章の一貫性をチェック',
              ]}
              compact
            />
          </div>
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
            {/* 工場（ベルトコンベア）演出 */}
            {isRunning && (
              <div className="mb-8">
                <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-slate-50 overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">工場稼働中（いま作ってます）</p>
                        <p className="text-[10px] font-bold text-gray-500">
                          現在の工程「{STEP_LABELS[job.step] || job.step}」は平均 {Math.max(1, Math.round(stepExpected / 60))}分以内が多いです
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
                      ベルトコンベア稼働中
                    </div>
                  </div>

                  <div className="relative overflow-hidden px-4 sm:px-6 py-6">
                    {/* ベルト本体（斜線が流れる） */}
                    <div className="absolute inset-x-4 sm:inset-x-6 top-1/2 -translate-y-1/2 h-16 rounded-3xl border border-gray-200 bg-slate-50 shadow-inner" />
                    <motion.div
                      className="absolute inset-x-4 sm:inset-x-6 top-1/2 -translate-y-1/2 h-16 rounded-3xl opacity-60"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(45deg, rgba(37,99,235,0.06) 0px, rgba(37,99,235,0.06) 12px, rgba(99,102,241,0.03) 12px, rgba(99,102,241,0.03) 24px)',
                        backgroundSize: '40px 40px',
                      }}
                      animate={{ backgroundPositionX: ['0px', '-240px'] }}
                      transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    />
                    {/* 視線誘導（中央スポットライト） */}
                    <div className="pointer-events-none absolute inset-x-4 sm:inset-x-6 top-1/2 -translate-y-1/2 h-16 rounded-3xl">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                    </div>
                    {/* ローラー */}
                    <div className="absolute inset-x-6 sm:inset-x-8 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full bg-white/70 border border-gray-200/70 shadow-sm flex items-center justify-center opacity-45"
                        >
                          <div className="w-2 h-2 rounded-full bg-gray-200" />
                        </div>
                      ))}
                    </div>

                    {/* 箱（工程）がベルト上を流れる */}
                    <motion.div
                      className="relative flex gap-5 w-[260%] py-2 z-10"
                      animate={{ x: ['0%', '-55%'] }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    >
                      {[...STEPS, ...STEPS].map((s, i) => {
                        const isCur = String(s.key).toLowerCase() === currentStepKey
                        const isDoneStep = STEPS.findIndex((x) => x.key === s.key) < currentStepIndex
                        const Icon = s.icon
                        return (
                          <motion.div
                            key={`${s.key}_${i}`}
                            className={`relative min-w-[180px] px-4 py-3 rounded-2xl border shadow-lg flex items-center gap-3 backdrop-blur-[1px] ${
                              isCur
                                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30 ring-2 ring-blue-300'
                                : isDoneStep
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                : 'bg-white text-gray-900 border-gray-200'
                            }`}
                            animate={isCur ? { y: [0, -1, 0] } : { y: [0, -0.5, 0] }}
                            transition={{ duration: isCur ? 1.4 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            {/* 車輪っぽい丸（主張を弱めて見やすく） */}
                            <div className="pointer-events-none absolute -bottom-1.5 left-5 flex gap-2 opacity-25">
                              <div className={`w-3.5 h-3.5 rounded-full border ${isCur ? 'bg-white/20 border-white/30' : 'bg-white border-gray-200'}`} />
                              <div className={`w-3.5 h-3.5 rounded-full border ${isCur ? 'bg-white/20 border-white/30' : 'bg-white border-gray-200'}`} />
                            </div>

                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isCur ? 'bg-white/15' : isDoneStep ? 'bg-emerald-100' : 'bg-gray-50'
                              }`}
                            >
                              {isCur ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className={`w-5 h-5 ${isDoneStep ? 'text-emerald-700' : 'text-gray-700'}`} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black truncate">{s.label}</p>
                              <p className={`text-[10px] font-bold truncate ${isCur ? 'text-white/85' : isDoneStep ? 'text-emerald-700/80' : 'text-gray-500'}`}>
                                {isCur ? '加工中…（稼働中）' : isDoneStep ? '完了' : '待機'}
                              </p>
                            </div>
                          </motion.div>
                        )
                      })}
                    </motion.div>

                    {/* 両端フェード */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
                  </div>
                </div>
              </div>
            )}

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
                  <p className="mt-1 text-[10px] font-bold text-gray-400">
                    進捗が止まって見えてもOKです（特に「記事統合」「図解生成」）。最終更新が動いていれば正常稼働です。
                  </p>
                </motion.div>
              </AnimatePresence>
            )}

            {/* “動いてる感”ログ */}
            {isRunning && (
              <div className="mb-8">
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">稼働ログ（最新）</p>
                  <div className="space-y-2">
                    {(stepHistory.length ? stepHistory : [{ step: job.step, at: Date.now() }]).map((h, i) => (
                      <div key={`${h.step}_${h.at}_${i}`} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <p className="text-xs font-black text-gray-700 truncate">{STEP_LABELS[h.step] || h.step}</p>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                          {Math.max(0, Math.floor((Date.now() - h.at) / 1000))}秒前
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black transition-all shadow-sm ${
                  isDone
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95'
                } disabled:opacity-50`}
                onClick={isDone ? goToArticle : advanceOnce}
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
                  onClick={goToArticle}
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
          {articleHref ? (
            <Link
              href={articleHref}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-bold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              記事ページを開く
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 text-gray-300 text-sm font-bold">
              <ExternalLink className="w-4 h-4" />
              記事ページを開く（準備中）
            </span>
          )}
        </motion.div>
      </div>
    </main>
  )
}
