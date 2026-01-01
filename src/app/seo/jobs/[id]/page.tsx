'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import {
  ArrowRight,
  ExternalLink,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
  Brain,
  PenTool,
  Layers,
  Image as ImageIcon,
  Rocket,
  PartyPopper,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { CompletionModal } from '@seo/components/CompletionModal'
import { patchSeoClientSettings, readSeoClientSettings } from '@seo/lib/clientSettings'
import { AiThinkingStrip } from '@seo/components/AiThinkingStrip'
import { FeatureGuide } from '@/components/FeatureGuide'

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
  meta?: any
  articleId: string
  article: {
    id: string
    title: string
    outline?: string | null
    targetChars: number
    referenceUrls?: any
    comparisonCandidates?: any
    comparisonConfig?: any
  }
  sections: SeoSection[]
  createdAt?: string
  updatedAt?: string
  startedAt?: string | null
}

function hostnameFromUrl(url: string): string {
  const s = String(url || '').trim()
  if (!s) return ''
  try {
    return new URL(s).hostname
  } catch {
    return ''
  }
}

type ActivityLogItem = {
  id: string
  at: number
  kind: 'heartbeat' | 'progress' | 'step' | 'status' | 'info' | 'error' | 'success'
  title: string
  detail?: string
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function formatHhMmSs(ms: number) {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function stripMarkdown(md: string): string {
  const s = String(md || '')
  // ライブ表示用：ざっくりプレーンテキストへ
  return s
    .replace(/!\[[^\]]*?\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+\n/g, '\n')
    .trim()
}

function buildSimulatedDraft(args: { title: string; heading: string; tone: string }) {
  const t = String(args.title || '').trim()
  const h = String(args.heading || '').trim()
  const tone = String(args.tone || '').trim() || '丁寧'
  const lines = [
    `まず結論：${t ? `「${t}」` : '今回のテーマ'}の要点を整理します。`,
    '',
    `- ここで扱うポイント：${h || 'このセクションの要点'}`,
    '- 迷いやすい判断基準：比較軸／優先順位／落とし穴',
    '- すぐ使える具体例：テンプレ／チェックリスト／手順',
    '',
    `文章トーン：${tone}（読みやすさ優先で推敲中）`,
    '',
    '…（執筆中）',
  ]
  return lines.join('\n')
}

function useTypewriter(text: string, opts?: { cps?: number; maxChars?: number }) {
  const cps = Math.max(15, Math.min(90, Number(opts?.cps || 55))) // chars per second
  const maxChars = Math.max(240, Math.min(1400, Number(opts?.maxChars || 900)))
  const src = String(text || '').slice(0, maxChars)
  const [out, setOut] = useState('')
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    if (!src) {
      setOut('')
      return
    }
    startRef.current = performance.now()
    setOut('')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startRef.current)
      const n = Math.min(src.length, Math.floor((elapsed / 1000) * cps))
      setOut(src.slice(0, Math.max(1, n)))
      if (n < src.length) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  return out
}


export default function SeoJobPage() {
  const params = useParams<{ id: string }>()
  const jobId = params.id
  const router = useRouter()
  const [job, setJob] = useState<SeoJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionPopupEnabled, setCompletionPopupEnabled] = useState(true)
  const prevStatusRef = useRef<string | null>(null)
  const dontShowAgainRef = useRef(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null)
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([])
  const logWrapRef = useRef<HTMLDivElement | null>(null)
  const [logAutoScroll, setLogAutoScroll] = useState(true)
  const logAutoScrollRef = useRef(true)
  const lastProgressRef = useRef<number | null>(null)
  const lastHeartbeatLogAtRef = useRef<number>(0)
  const logPrevStatusRef = useRef<string | null>(null)
  const logPrevStepRef = useRef<string | null>(null)
  const logPrevSectionCountRef = useRef<number>(0)
  const logPrevGeneratingSectionRef = useRef<string | null>(null)
  const [openPreviewIds, setOpenPreviewIds] = useState<Record<string, boolean>>({})
  const seenResearchEventIdsRef = useRef<Set<string>>(new Set())
  const [showResearchPanel, setShowResearchPanel] = useState(true)

  const reviewedCount = useMemo(
    () => (job?.sections || []).filter((s) => s.status === 'reviewed' || s.status === 'generated').length,
    [job]
  )

  const reviewedSections = useMemo(() => {
    const list = (job?.sections || []).filter((s) => s.status === 'reviewed' || s.status === 'generated')
    // index順で安定表示
    return list.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  }, [job?.sections])

  const generatingSection = useMemo(() => {
    const list = job?.sections || []
    return list.find((s) => s.status === 'generating') || null
  }, [job?.sections])

  const lastCompletedSection = useMemo(() => {
    if (!reviewedSections.length) return null
    return reviewedSections[reviewedSections.length - 1] || null
  }, [reviewedSections])

  const liveHeading = String(generatingSection?.headingPath || lastCompletedSection?.headingPath || '').trim()
  const liveSource = useMemo(() => {
    const tone = String((job as any)?.article?.tone || '').trim()
    const title = String(job?.article?.title || '').trim()
    const raw = String((generatingSection?.content || lastCompletedSection?.content || '') || '').trim()
    if (raw) return stripMarkdown(raw)
    if (generatingSection) return stripMarkdown(buildSimulatedDraft({ title, heading: liveHeading, tone }))
    return stripMarkdown(buildSimulatedDraft({ title, heading: liveHeading || '本文', tone }))
  }, [generatingSection, lastCompletedSection, job?.article?.title, (job as any)?.article?.tone, liveHeading])

  const liveTyped = useTypewriter(liveSource, { cps: 65, maxChars: 900 })

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

  const pushLog = useCallback((item: Omit<ActivityLogItem, 'id'>) => {
    setActivityLog((prev) => {
      const next: ActivityLogItem[] = [
        ...prev,
        {
          ...item,
          id: `${item.at}_${Math.random().toString(16).slice(2)}`,
        },
      ]
      // 最大200件（重くしない）
      if (next.length > 200) return next.slice(next.length - 200)
      return next
    })
  }, [])

  // NOTE: pushLog を依存配列に入れる都合上、必ず pushLog の「後」に定義する（TDZ回避）
  const copyText = useCallback(
    async (text: string) => {
      const s = String(text || '').trim()
      if (!s) return
      try {
        await navigator.clipboard.writeText(s)
        pushLog({ at: Date.now(), kind: 'success', title: '📋 クリップボードにコピーしました', detail: s.slice(0, 120) })
      } catch {
        pushLog({ at: Date.now(), kind: 'error', title: 'コピーに失敗しました', detail: 'ブラウザの権限を確認してください' })
      }
    },
    [pushLog]
  )

  // ログの自動スクロール（ユーザーが上に戻ったら停止）
  useEffect(() => {
    const el = logWrapRef.current
    if (!el) return
    if (!logAutoScrollRef.current) return
    el.scrollTop = el.scrollHeight
  }, [activityLog.length])

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
        // 404は「ジョブが存在しない」だけでなく「所有者チェックNG」でも返す（情報漏洩防止）
        // そのためUI側では分かりやすいガイドを出す
        const raw = String(json?.error || '').trim()
        if (res.status === 404 || raw === 'not found') {
          throw new Error(
            [
              'ジョブが見つかりませんでした。',
              '',
              '考えられる原因:',
              '- 作成したブラウザ/端末と違う（ゲストIDが一致せず参照できません）',
              '- ログイン状態が変わった（別アカウント/ログアウト等）',
              '',
              '対処:',
              '- 作成したブラウザ/端末でこのURLを開き直してください',
              '- もしくはログインして再度お試しください',
            ].join('\n')
          )
        }
        throw new Error(raw || `API Error: ${res.status}`)
      }

      const newJob = json.job || null
      if (newJob) {
        setLastHeartbeatAt(Date.now())
        setJob(newJob)

        // リサーチ実況（サーバ側metaからイベントを取り込み、稼働ログにも流す）
        try {
          const events = Array.isArray(newJob?.meta?.researchEvents) ? (newJob.meta.researchEvents as any[]) : []
          if (events.length) {
            for (const ev of events.slice(-60)) {
              const id = String(ev?.id || '')
              if (!id) continue
              if (seenResearchEventIdsRef.current.has(id)) continue
              seenResearchEventIdsRef.current.add(id)
              const kind = String(ev?.kind || '')
              const prefix =
                kind === 'search' ? '🔎' :
                kind === 'candidates' ? '🏁' :
                kind === 'discover' ? '🧭' :
                kind === 'queue' ? '📥' :
                kind === 'fetch' ? '🌐' :
                kind === 'summarize' ? '🧠' :
                kind === 'store' ? '📚' :
                kind === 'warn' ? '⚠️' :
                kind === 'error' ? '🛑' : 'ℹ️'
              const title = `${prefix} ${String(ev?.title || 'リサーチ中…')}`
              const detail = [ev?.detail, ev?.url].filter(Boolean).join('\n')
              pushLog({
                at: Number(ev?.at || Date.now()),
                kind: kind === 'warn' ? 'info' : kind === 'error' ? 'error' : 'info',
                title,
                detail: detail ? String(detail).slice(0, 260) : undefined,
              })
            }
          }
        } catch {
          // ignore
        }

        // 詳細ログ：セクション生成進捗を追跡
        const now = Date.now()
        const sections = newJob.sections || []
        const generatingSections = sections.filter((s: any) => s.status === 'generating')
        const generatedSections = sections.filter((s: any) => s.status === 'generated' || s.status === 'reviewed')
        const pendingSections = sections.filter((s: any) => s.status === 'pending')
        
        // 10秒ごとに詳細な進捗ログを追加（冗長にならないように）
        if (now - lastHeartbeatLogAtRef.current >= 10000) {
          lastHeartbeatLogAtRef.current = now
          const step = String(newJob.step || '').toLowerCase()
          const progress = clamp(Number(newJob.progress || 0), 0, 100)
          
          // 工程別の詳細メッセージ
          let detailTitle = ''
          let detailInfo = ''
          
          if (step === 'outline') {
            detailTitle = '📝 記事の構成を設計中...'
            detailInfo = 'SEO・LLMOに最適な見出し構造を分析しています'
          } else if (step === 'sections') {
            if (generatingSections.length > 0) {
              const currentSection = generatingSections[0] as any
              // headingPathから見出しテキストを抽出
              const headingText = String(currentSection?.headingPath || `セクション${(currentSection?.index ?? 0) + 1}`)
                .replace(/^#+\s*/, '')
                .slice(0, 30)
              detailTitle = `✍️ 「${headingText}」を執筆中...`
              detailInfo = `完了: ${generatedSections.length}/${sections.length}セクション`
            } else if (pendingSections.length > 0) {
              detailTitle = '🔄 次のセクション準備中...'
              detailInfo = `完了: ${generatedSections.length}/${sections.length}セクション`
            } else {
              detailTitle = '📊 本文執筆を進行中...'
              detailInfo = `進捗: ${progress}%`
            }
          } else if (step === 'integrate') {
            detailTitle = '🔗 記事を統合・最終調整中...'
            detailInfo = '全セクションを結合し、文章の一貫性を確認しています'
          } else if (step === 'media') {
            detailTitle = '🎨 バナー・図解を生成中...'
            detailInfo = 'AIが記事に合った画像を描画しています'
          } else if (step === 'done') {
            detailTitle = '✅ 記事生成が完了しました'
            detailInfo = 'すべての工程が正常に終了しました'
          } else {
            detailTitle = `⚙️ 工程「${STEP_LABELS[step] || step}」を実行中...`
            detailInfo = `進捗: ${progress}%`
          }
          
          pushLog({
            at: now,
            kind: 'info',
            title: detailTitle,
            detail: detailInfo,
          })
        }
      }
    } catch (e: any) {
      if (showLoading || !jobRef.current) setJob(null)
      const msg =
        e?.name === 'AbortError'
          ? '読み込みがタイムアウトしました。再読み込みしてください。'
          : e?.message || '読み込みに失敗しました'
      setLoadError(msg)
      pushLog({
        at: Date.now(),
        kind: 'error',
        title: '読み込みに失敗しました',
        detail: msg,
      })
    }
    if (showLoading) setLoading(false)
    isPollingRef.current = false
  }, [jobId, pushLog])

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

  // 状態/ステップ/進捗の変化をログに積む（“動いてる感”の強化）
  useEffect(() => {
    if (!job) return
    const now = Date.now()

    // 状態変化
    if (logPrevStatusRef.current && logPrevStatusRef.current !== job.status) {
      pushLog({
        at: now,
        kind: 'status',
        title: `状態が「${JOB_STATUS_LABELS[job.status] || job.status}」になりました`,
      })
    }
    logPrevStatusRef.current = job.status

    // ステップ変化（工程別の詳細説明付き）
    const stepCur = String(job.step || '').toLowerCase()
    if (logPrevStepRef.current && logPrevStepRef.current !== stepCur) {
      const stepDetails: Record<string, { icon: string; desc: string }> = {
        outline: { icon: '📋', desc: 'SEO・LLMOに最適な記事構成を設計します' },
        sections: { icon: '✍️', desc: '各セクションの本文を順次執筆していきます' },
        integrate: { icon: '🔗', desc: '全セクションを統合し、文章の一貫性を調整します' },
        media: { icon: '🎨', desc: 'バナー画像・図解を生成します' },
        done: { icon: '✅', desc: 'すべての工程が完了しました' },
        cmp_ref: { icon: '🔍', desc: '参考記事を解析しています' },
        cmp_candidates: { icon: '📊', desc: '比較対象の候補を収集しています' },
        cmp_crawl: { icon: '🌐', desc: 'サイトを巡回して情報を収集しています' },
        cmp_extract: { icon: '📄', desc: '必要な情報を抽出しています' },
        cmp_sources: { icon: '📚', desc: '出典情報を整形しています' },
        cmp_tables: { icon: '📈', desc: '比較表を生成しています' },
        cmp_outline: { icon: '📝', desc: '章立てを生成しています' },
        cmp_polish: { icon: '✨', desc: '文章を校正しています' },
      }
      const detail = stepDetails[stepCur] || { icon: '⚙️', desc: '' }
      pushLog({
        at: now,
        kind: 'step',
        title: `${detail.icon} 工程「${STEP_LABELS[stepCur] || stepCur}」に移行`,
        detail: detail.desc,
      })
    }
    logPrevStepRef.current = stepCur

    // 進捗変化（10%刻みでログ出力、冗長にならないように）
    const p = clamp(Number(job.progress || 0), 0, 100)
    const pPrev = lastProgressRef.current
    if (pPrev === null) {
      lastProgressRef.current = p
      pushLog({
        at: now,
        kind: 'info',
        title: '🚀 記事生成を開始しました',
        detail: `現在の進捗: ${p}%`,
      })
    } else if (p !== pPrev) {
      const diff = p - pPrev
      lastProgressRef.current = p
      // 10%区切りを超えた時、または100%になった時のみログ
      const prevTenth = Math.floor(pPrev / 10)
      const currTenth = Math.floor(p / 10)
      if (currTenth > prevTenth || p === 100) {
        const milestoneMessages = [
          { threshold: 10, icon: '📊', msg: '構成分析中...' },
          { threshold: 20, icon: '📝', msg: '見出し構造を確定中...' },
          { threshold: 30, icon: '✍️', msg: '本文執筆開始...' },
          { threshold: 40, icon: '📖', msg: '本文執筆継続中...' },
          { threshold: 50, icon: '⚡', msg: '折り返し地点を通過' },
          { threshold: 60, icon: '📄', msg: '本文執筆後半...' },
          { threshold: 70, icon: '🔍', msg: 'SEO最適化中...' },
          { threshold: 80, icon: '🔗', msg: '記事統合・調整中...' },
          { threshold: 90, icon: '✨', msg: '最終仕上げ中...' },
          { threshold: 100, icon: '🎉', msg: '記事生成完了！' },
        ]
        const milestone = milestoneMessages.find(m => m.threshold === currTenth * 10) || 
                          milestoneMessages.find(m => m.threshold === 100 && p === 100)
        if (milestone) {
          pushLog({
            at: now,
            kind: 'progress',
            title: `${milestone.icon} ${p}% 完了 - ${milestone.msg}`,
            detail: diff > 0 ? `+${diff}%` : undefined,
          })
        }
      }
    }
  }, [job?.status, job?.step, job?.progress, job, pushLog])

  // セクション完了ログ
  useEffect(() => {
    if (!job) return
    const sections = job.sections || []
    const generatedSections = sections.filter((s) => s.status === 'generated' || s.status === 'reviewed')
    const generatingSections = sections.filter((s) => s.status === 'generating')
    const now = Date.now()
    
    // セクション完了数が増えたらログに追加
    const prevCount = logPrevSectionCountRef.current
    const currCount = generatedSections.length
    if (currCount > prevCount && prevCount > 0) {
      // 新しく完了したセクションを特定
      const newlyCompleted = currCount - prevCount
      for (let i = 0; i < newlyCompleted; i++) {
        const sectionIndex = prevCount + i
        const section = generatedSections[sectionIndex]
        if (section) {
          // headingPathから見出しテキストを抽出（例: "## 見出し" → "見出し"）
          const headingText = String(section.headingPath || `セクション${section.index + 1}`)
            .replace(/^#+\s*/, '')
            .slice(0, 35)
          pushLog({
            at: now + i, // 微妙にずらして順序を保証
            kind: 'success',
            title: `✅ 「${headingText}」の執筆完了`,
            detail: `${currCount}/${sections.length}セクション完了`,
          })
        }
      }
    }
    logPrevSectionCountRef.current = currCount
    
    // 現在生成中のセクションが変わったらログに追加
    const currGenerating = generatingSections.length > 0 ? String(generatingSections[0].id || '') : null
    const prevGenerating = logPrevGeneratingSectionRef.current
    if (currGenerating && currGenerating !== prevGenerating) {
      const section = generatingSections[0]
      const headingText = String(section.headingPath || `セクション${section.index + 1}`)
        .replace(/^#+\s*/, '')
        .slice(0, 35)
      const index = sections.findIndex((s) => s.id === section.id) + 1
      pushLog({
        at: now,
        kind: 'info',
        title: `✍️ セクション${index}「${headingText}」の執筆開始`,
        detail: `残り${sections.length - generatedSections.length}セクション`,
      })
    }
    logPrevGeneratingSectionRef.current = currGenerating
  }, [job?.sections, job, pushLog])

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

  // 旧: stepHistory（ステップ変化のみ）は廃止し、activityLogへ統合

  // 自動で工程を進め続ける（UIで停止/再開は提供しない）
  useEffect(() => {
    if (!job) return
    if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') return
    const t = setTimeout(() => {
      advanceOnce()
    }, 700)
    return () => clearTimeout(t)
  }, [job?.status, job?.step, job?.progress, advanceOnce, job])

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
  const researchLast = (job as any)?.meta?.researchLast || null
  const researchStats = (job as any)?.meta?.researchStats || null
  const researchEvents = useMemo(() => {
    const list = Array.isArray((job as any)?.meta?.researchEvents) ? ((job as any).meta.researchEvents as any[]) : []
    // 最新を上に
    return list.slice(-12).reverse()
  }, [job])
  const progressPct = clamp(Number(job.progress || 0), 0, 100)
  const heartbeatAgo = lastHeartbeatAt ? Math.max(0, Math.floor((Date.now() - lastHeartbeatAt) / 1000)) : null
  const articleIdSafe = String(job.articleId || job.article?.id || '').trim()
  const articleHref = articleIdSafe ? `/seo/articles/${articleIdSafe}` : ''
  const goToArticle = () => {
    if (!articleHref) {
      setActionError('記事IDが取得できませんでした。少し待って再読み込みしてください。')
      return
    }
    // ルーティングの状態に左右されないよう、確実に遷移する
    try {
      window.location.assign(articleHref)
    } catch {
      router.push(articleHref)
    }
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
          className="text-left mb-8"
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
              <div className="mt-2 text-[10px] font-bold text-gray-400 flex items-center gap-2">
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
          <div className="mt-4 flex items-center">
            <FeatureGuide
              featureId="seo.jobProgress"
              title="生成中画面の見方"
              description="いま何をしているか／どこまで進んだか／完成済み本文のプレビューを、この画面だけで確認できます。"
              steps={[
                '上部の進捗%と工程で、全体の進み具合を把握します',
                '「稼働ログ」で、心拍・進捗・工程変化を確認できます',
                '下の「完成済み本文プレビュー」で、出来上がったところから読めます',
                '完了後は「記事を見る」で本文＋画像の画面へ移動します',
              ]}
              imageMode="off"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-500">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : isError ? 'bg-red-500' : 'bg-gray-300'}`} />
              <span>状態: {JOB_STATUS_LABELS[job.status] || job.status}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm">
              <span className="text-blue-600 font-black">工程:</span>
              <span>{STEP_LABELS[job.step] || job.step}</span>
            </div>
          </div>

          {/* 経過時間のみ表示 */}
          <div className="mt-5 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left max-w-xs">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <Clock className="w-4 h-4 text-gray-500" />
                経過時間
              </div>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">
                {formatMmSs(elapsed)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-400">開始からの経過</p>
            </div>
          </div>

          {/* セクション進捗（上に上げる） */}
          {!isDone && job.sections.length > 0 && (
            <div className="mt-6 max-w-5xl mx-auto">
              <div className="bg-white rounded-[28px] border border-gray-100 shadow-xl shadow-blue-500/5 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    セクション進捗
                    <span className="text-xs font-black text-gray-500">
                      （{reviewedCount}/{job.sections.length}）
                    </span>
                  </h2>
                  <div className="text-[10px] font-black text-gray-500">
                    {heartbeatAgo === null ? '通信中…' : `最終更新: ${heartbeatAgo}秒前`}
                  </div>
                </div>
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {job.sections.map((s, idx) => {
                    const isGenerating = s.status === 'generating'
                    const isComplete = s.status === 'reviewed' || s.status === 'generated'
                    const isErr = s.status === 'error'
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
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
                        {isGenerating && (
                          <motion.div
                            className="mb-3 h-1.5 rounded-full bg-gradient-to-r from-blue-200 via-blue-500 to-indigo-200"
                            animate={{ backgroundPositionX: ['0%', '100%'] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                            style={{ backgroundSize: '200% 100%' }}
                          />
                        )}
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
              </div>
            </div>
          )}

          {/* “できていく”演出（上部に配置） */}
          {!isDone && !isError && (
            <div className="mt-6 max-w-5xl mx-auto">
              <div className="bg-white rounded-[28px] border border-gray-100 shadow-xl shadow-blue-500/5 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">制作中（ライブ）</p>
                    <p className="text-sm sm:text-base font-black text-gray-900 truncate">
                      {job.step?.toLowerCase() === 'outline'
                        ? '見出しを組み立て中'
                        : job.step?.toLowerCase() === 'sections'
                          ? '本文を執筆中'
                          : job.step?.toLowerCase() === 'integrate'
                            ? '推敲・統合中'
                            : job.step?.toLowerCase() === 'media'
                              ? 'バナー/図解を生成中'
                              : '準備中'}
                    </p>
                  </div>
                  <div className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
                    生成中
                  </div>
                </div>

                <div className="p-5 sm:p-6 grid lg:grid-cols-2 gap-5">
                  {/* 進行アクション */}
                  <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-slate-50 p-5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">いま起きていること</p>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">タイトル確定</p>
                          <p className="text-[11px] font-bold text-gray-500 truncate">{job.article.title}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                          job.article.outline ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
                        }`}>
                          {job.article.outline ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">見出し（構成）</p>
                          <p className="text-[11px] font-bold text-gray-500">
                            {job.article.outline ? '見出しが確定しました' : '見出しを設計しています'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900">本文執筆</p>
                          <p className="text-[11px] font-bold text-gray-500">
                            {generatingSection ? `「${String(generatingSection.headingPath || '').replace(/^#+\\s*/, '').slice(0, 26)}」を書いています` : '推敲しながら書き進めています'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ライブ執筆（タイピング演出） - リッチUI */}
                  <div className="rounded-3xl border border-gray-200/60 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-6 shadow-lg shadow-blue-500/5 relative overflow-hidden">
                    {/* 背景装飾 */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400/10 to-indigo-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-emerald-400/10 to-cyan-400/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                    
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-500/20">
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ライブ執筆
                        </div>
                        <h3 className="mt-3 text-lg font-black text-gray-900 leading-tight" style={{ fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" }}>
                          {liveHeading ? liveHeading : '本文を執筆中...'}
                        </h3>
                      </div>
                      <div className="flex-shrink-0 px-3 py-2 rounded-xl bg-white/80 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">経過</p>
                        <p className="text-lg font-black text-gray-900 tabular-nums" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
                          {formatMmSs(elapsed)}
                        </p>
                      </div>
                    </div>
                    
                    {/* 本文プレビュー - エディタ風 */}
                    <div className="relative mt-5 rounded-2xl border border-gray-200/80 bg-white shadow-inner overflow-hidden">
                      {/* エディタヘッダー */}
                      <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200/60 flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-red-400/80" />
                          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                          <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
                        </div>
                        <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Article Preview</span>
                      </div>
                      
                      {/* 本文エリア */}
                      <div className="p-6 min-h-[180px] max-h-[320px] overflow-y-auto bg-gradient-to-b from-white via-white to-slate-50/60">
                        <div
                          className="relative max-w-none text-left text-gray-900 antialiased selection:bg-blue-200/70 selection:text-blue-950"
                          style={{
                            fontFamily: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif",
                            fontSize: '15.5px',
                            letterSpacing: '0.018em',
                            lineHeight: 2.05,
                          }}
                        >
                          <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-blue-500/40 via-indigo-500/20 to-transparent rounded-full" />
                          <div className="pl-4">
                            {liveTyped.split('\n').map((line, i) => (
                              <p
                                key={i}
                                className="mb-3 last:mb-0 text-left whitespace-pre-wrap break-words text-gray-800/95 transition-colors"
                              >
                                {line || <span className="text-gray-300">　</span>}
                              </p>
                            ))}
                            <span
                              className="inline-block w-[3px] h-[1.2em] bg-gradient-to-b from-blue-500 to-indigo-600 ml-0.5 animate-pulse rounded-sm align-middle"
                              style={{ animationDuration: '0.8s' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* フッター */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-700">AIが執筆中</span>
                      </div>
                      <p className="text-[11px] font-bold text-gray-400">
                        セクション完了後、本文プレビューに反映されます
                      </p>
                    </div>
                  </div>
                </div>

                {/* リサーチ実況（検索/巡回/抽出の“動き”を、2カラムを跨いで“ドーン”と見せる） */}
                {(isComparison || researchLast) && (
                  <div className="px-5 sm:px-6 pb-6">
                    <div className="pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <motion.span
                              className="absolute -inset-1 rounded-full bg-emerald-400/40 blur"
                              animate={{ opacity: [0.25, 0.6, 0.25] }}
                              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <span className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black text-emerald-700">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              LIVE
                            </span>
                          </div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">リサーチ実況</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowResearchPanel((v) => !v)}
                          className="text-[10px] font-black text-blue-600 hover:text-blue-700"
                        >
                          {showResearchPanel ? '隠す' : '表示'}
                        </button>
                      </div>

                      {showResearchPanel && (
                        <div className="mt-3">
                          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-2xl shadow-indigo-500/10">
                            {/* glow */}
                            <div className="pointer-events-none absolute -inset-12 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),rgba(16,185,129,0.18),transparent_60%)]" />
                            {/* shimmer */}
                            <motion.div
                              className="pointer-events-none absolute -inset-y-24 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12"
                              animate={{ x: ['-30%', '260%'] }}
                              transition={{ duration: 3.8, repeat: Infinity, ease: 'linear' }}
                            />

                            <div className="relative p-6">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white/95">
                                    {researchLast?.title ? `いま：${String(researchLast.title)}` : 'いま：情報を調査中…'}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {researchLast?.url && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-black text-white/90">
                                        <ExternalLink className="w-3 h-3" />
                                        {hostnameFromUrl(String(researchLast.url)) || 'source'}
                                      </span>
                                    )}
                                    <span className="text-[11px] font-bold text-white/60">
                                      {researchLast?.detail || researchLast?.url || '検索/巡回/抽出を進めています'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  <p className="text-[10px] font-black text-white/60 tabular-nums">
                                    {researchLast?.at ? formatHhMmSs(Number(researchLast.at)) : ''}
                                  </p>
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-300/20 text-[10px] font-black text-emerald-200">
                                    <Zap className="w-3 h-3" />
                                    高速巡回中
                                  </div>
                                </div>
                              </div>

                              {/* counters + bars */}
                              {(() => {
                                const candidatesCount =
                                  typeof researchStats?.candidates === 'number'
                                    ? researchStats.candidates
                                    : Array.isArray((job.article as any)?.comparisonCandidates)
                                      ? (job.article as any).comparisonCandidates.length
                                      : 0
                                const candidatesTarget =
                                  typeof researchStats?.candidatesTarget === 'number'
                                    ? researchStats.candidatesTarget
                                    : typeof (job.article as any)?.comparisonConfig?.count === 'number'
                                      ? Number((job.article as any).comparisonConfig.count)
                                      : null
                                const urlsCount =
                                  typeof researchStats?.referenceUrls === 'number'
                                    ? researchStats.referenceUrls
                                    : Array.isArray((job.article as any)?.referenceUrls)
                                      ? (job.article as any).referenceUrls.length
                                      : 0
                                const candPct =
                                  candidatesTarget && candidatesTarget > 0
                                    ? clamp((candidatesCount / candidatesTarget) * 100, 0, 100)
                                    : null
                                return (
                                  <div className="mt-5 grid sm:grid-cols-2 gap-4">
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">候補</p>
                                      <p className="mt-1 text-xl font-black text-white tabular-nums">
                                        {candidatesCount}
                                        {candidatesTarget ? <span className="text-white/40">/{candidatesTarget}</span> : null}
                                      </p>
                                      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <motion.div
                                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-indigo-400"
                                          initial={{ width: '5%' }}
                                          animate={{ width: candPct !== null ? `${candPct}%` : ['8%', '70%', '25%'] }}
                                          transition={{
                                            duration: candPct !== null ? 0.6 : 1.6,
                                            repeat: candPct !== null ? 0 : Infinity,
                                            ease: candPct !== null ? 'easeOut' : 'easeInOut',
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">参考URL</p>
                                      <p className="mt-1 text-xl font-black text-white tabular-nums">{urlsCount}</p>
                                      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <motion.div
                                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-300 to-amber-300"
                                          animate={{ width: ['12%', '85%', '28%'] }}
                                          transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()}

                              {/* timeline */}
                              <div className="mt-5 rounded-2xl bg-black/20 border border-white/10 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                                    直近のアクション
                                  </p>
                                  <p className="text-[10px] font-black text-white/50 tabular-nums">
                                    {researchEvents.length ? `${researchEvents.length}件` : ''}
                                  </p>
                                </div>

                                <div className="mt-3 space-y-2 max-h-56 overflow-auto pr-1">
                                  {researchEvents.length ? (
                                    researchEvents.map((ev: any) => {
                                      const title = String(ev?.title || ev?.name || '調査').trim()
                                      const detail = String(ev?.detail || ev?.url || '').trim()
                                      const at = ev?.at ? formatHhMmSs(Number(ev.at)) : ''
                                      const host = hostnameFromUrl(detail) || hostnameFromUrl(String(ev?.url || ''))
                                      return (
                                        <div key={String(ev?.id || `${title}_${at}_${detail}`)} className="flex items-start gap-3">
                                          <div className="mt-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.18)] flex-shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-3">
                                              <p className="text-sm font-black text-white/90 truncate">{title}</p>
                                              <p className="text-[10px] font-black text-white/45 tabular-nums">{at}</p>
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                              {host && (
                                                <span className="text-[10px] font-black text-white/70 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full">
                                                  {host}
                                                </span>
                                              )}
                                              {detail && (
                                                <p className="text-[11px] font-bold text-white/55 break-words line-clamp-2">
                                                  {detail}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })
                                  ) : (
                                    <p className="text-[10px] font-bold text-white/60">リサーチイベントを待っています…</p>
                                  )}
                                </div>
                              </div>

                              {/* actions */}
                              <div className="mt-5 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = Array.isArray((job.article as any)?.comparisonCandidates)
                                      ? (job.article as any).comparisonCandidates
                                      : []
                                    const lines = list
                                      .map((c: any) => `${String(c?.name || '').trim()}${c?.websiteUrl ? `\t${String(c.websiteUrl).trim()}` : ''}`)
                                      .filter(Boolean)
                                      .join('\n')
                                    copyText(lines)
                                  }}
                                  className="h-11 px-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-black hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-lg shadow-blue-500/20"
                                >
                                  候補をコピー
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = Array.isArray((job.article as any)?.referenceUrls) ? (job.article as any).referenceUrls : []
                                    const lines = list.map((u: any) => String(u || '').trim()).filter(Boolean).join('\n')
                                    copyText(lines)
                                  }}
                                  className="h-11 px-5 rounded-2xl bg-white/10 border border-white/15 text-white text-xs font-black hover:bg-white/15 transition-colors"
                                >
                                  参考URLをコピー
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
            {/* ベルトコンベア/Tips は分かりにくいため削除（上部のライブ演出で代替） */}

            {/* “動いてる感”ログ（より細かく・スクロールで追える） */}
            {(isRunning || isPaused) && (
              <div className="mb-8">
                <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">稼働ログ</p>
                      <p className="text-sm font-black text-gray-900 mt-1 truncate">
                        記事制作の進捗ログ
                      </p>
                    </div>
                    {!logAutoScroll && (
                      <button
                        type="button"
                        className="h-9 px-4 rounded-xl bg-blue-600 text-white text-xs font-black shadow-sm hover:bg-blue-700 transition-colors"
                        onClick={() => {
                          const el = logWrapRef.current
                          if (!el) return
                          el.scrollTop = el.scrollHeight
                          logAutoScrollRef.current = true
                          setLogAutoScroll(true)
                        }}
                      >
                        最新へ
                      </button>
                    )}
                  </div>

                  <div
                    ref={logWrapRef}
                    onScroll={() => {
                      const el = logWrapRef.current
                      if (!el) return
                      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
                      logAutoScrollRef.current = atBottom
                      if (logAutoScroll !== atBottom) setLogAutoScroll(atBottom)
                    }}
                    className="max-h-[260px] overflow-y-auto px-5 py-4 space-y-3 bg-gradient-to-b from-white to-slate-50"
                  >
                    {(activityLog.length ? activityLog : [{
                      id: 'seed',
                      at: Date.now(),
                      kind: 'info' as const,
                      title: '稼働ログを準備中…',
                      detail: 'まもなくログが流れ始めます',
                    }]).map((it) => {
                      const ageSec = Math.max(0, Math.floor((Date.now() - it.at) / 1000))
                      const tone =
                        it.kind === 'error'
                          ? { dot: 'bg-red-500', text: 'text-red-700' }
                          : it.kind === 'progress'
                          ? { dot: 'bg-indigo-600', text: 'text-gray-900' }
                          : it.kind === 'step'
                          ? { dot: 'bg-blue-600', text: 'text-gray-900' }
                          : it.kind === 'status'
                          ? { dot: 'bg-amber-500', text: 'text-gray-900' }
                          : it.kind === 'heartbeat'
                          ? { dot: 'bg-emerald-500', text: 'text-gray-900' }
                          : { dot: 'bg-gray-400', text: 'text-gray-900' }

                      return (
                        <div key={it.id} className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className={`mt-1 w-2.5 h-2.5 rounded-full ${tone.dot}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-black ${tone.text} truncate`}>
                                {it.title}
                              </p>
                              {it.detail && (
                                <p className="text-[10px] font-bold text-gray-500 mt-1 break-words">
                                  {it.detail}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-[10px] font-black text-gray-400 tabular-nums">{formatHhMmSs(it.at)}</p>
                            <p className="text-[10px] font-bold text-gray-400 tabular-nums">{ageSec}秒前</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              {isDone ? (
                articleHref ? (
                  <Link
                    href={articleHref}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shadow-sm"
                    prefetch={false}
                  >
                    <PartyPopper className="w-5 h-5" />
                    記事を見る
                  </Link>
                ) : (
                  <button
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gray-200 text-gray-500 font-black shadow-sm cursor-not-allowed"
                    disabled
                    title="記事IDを取得中です。少し待ってから再読み込みしてください。"
                  >
                    <Lock className="w-5 h-5" />
                    記事を見る（準備中）
                  </button>
                )
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-sm opacity-90 cursor-not-allowed"
                    disabled
                    title="処理は自動で進行します"
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    処理中...
                  </button>

                  <button
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-red-50 text-red-700 border border-red-100 font-black hover:bg-red-100/60 transition-all"
                    onClick={async () => {
                      if (!confirm('ジョブをキャンセルしますか？（途中成果物は残ります）')) return
                      setActionError(null)
                      try {
                        await fetch(`/api/seo/jobs/${jobId}/cancel`, { method: 'POST' })
                        await load({ showLoading: false })
                      } catch (e: any) {
                        setActionError(e?.message || '失敗しました')
                      }
                    }}
                    disabled={busy || job.status === 'cancelled'}
                  >
                    キャンセル
                  </button>
                </>
              )}
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
                    <p className="mt-4 text-xs font-bold text-red-700/80">
                      エラーが発生しました。ページを再読み込みするか、必要に応じてキャンセルしてください。
                    </p>
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

        {/* 完成済み本文プレビュー（生成中でも“できたところ”が読める） */}
        {!isDone && reviewedSections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8"
          >
            <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">途中プレビュー</p>
                  <p className="text-base sm:text-lg font-black text-gray-900 truncate">
                    完成済み本文プレビュー（{reviewedSections.length}件）
                  </p>
                </div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
                  できたところから読めます
                </span>
              </div>
              <div className="max-h-[480px] overflow-y-auto p-4 sm:p-6 space-y-3 bg-gradient-to-b from-white to-slate-50">
                {reviewedSections.map((s) => {
                  const open = !!openPreviewIds[s.id]
                  const heading = s.headingPath || `セクション ${Number(s.index ?? 0) + 1}`
                  const content = String(s.content || '').trim()
                  return (
                    <div key={s.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                      <button
                        type="button"
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                        onClick={() =>
                          setOpenPreviewIds((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                        }
                      >
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-black text-gray-900 truncate">{heading}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-gray-500">
                            {content ? `${Math.min(99999, content.length).toLocaleString()}文字` : '本文生成中…'}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-gray-400">
                          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="px-4 pb-4"
                          >
                            {content ? (
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <MarkdownPreview markdown={content} />
                              </div>
                            ) : (
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                                <div className="mt-2 h-3 w-full bg-gray-200 rounded animate-pulse" />
                                <div className="mt-2 h-3 w-5/6 bg-gray-200 rounded animate-pulse" />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
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
            isDone ? (
              <Link
                href={articleHref}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-bold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                記事ページを開く
              </Link>
            ) : (
              <span
                className="inline-flex items-center gap-2 text-gray-300 text-sm font-bold"
                title="記事生成が完了すると開けます"
              >
                <Lock className="w-4 h-4" />
                記事ページを開く（生成中）
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-2 text-gray-300 text-sm font-bold">
              <Lock className="w-4 h-4" />
              記事ページを開く（準備中）
            </span>
          )}
        </motion.div>
      </div>
    </main>
  )
}

