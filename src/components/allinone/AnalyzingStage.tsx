'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Gauge,
  Search,
  Target,
  Palette,
  Image as ImageIcon,
  ListChecks,
  Trophy,
  CheckCircle2,
  Loader2,
  XCircle,
  Sparkles,
  Database,
} from 'lucide-react'
import { consumeSse } from '@/lib/allinone/client-sse'
import type { AnalyzeSseEvent, AnalysisStep } from '@/lib/allinone/types'

const STEPS: {
  id: AnalysisStep
  label: string
  icon: React.ElementType
  tip: string
  color: string
}[] = [
  { id: 'scrape',    label: 'サイト取得',  icon: Globe,     tip: 'HTML・OGP・メタ・構造化データを解析中',  color: '#7C5CFF' },
  { id: 'pagespeed', label: 'PageSpeed',   icon: Gauge,     tip: 'モバイル/デスクトップの速度を計測中',    color: '#22D3EE' },
  { id: 'site',      label: 'サイト診断',  icon: Trophy,    tip: '第一印象・強み・弱みを採点中',           color: '#00E5A0' },
  { id: 'seo',       label: 'SEO診断',     icon: Search,    tip: '検索意図・不足キーワードを算出中',       color: '#FFB547' },
  { id: 'persona',   label: 'ペルソナ',    icon: Target,    tip: '代表3名の肖像を生成中',                  color: '#FF5C7C' },
  { id: 'branding',  label: 'ブランド',    icon: Palette,   tip: 'トーン・パレット・フォントを診断中',     color: '#B9A8FF' },
  { id: 'visual',    label: 'ビジュアル',  icon: ImageIcon, tip: 'キービジュアル3案をデザイン中',          color: '#F97316' },
  { id: 'action',    label: 'アクション',  icon: ListChecks,tip: '優先度付き改善プランを構成中',           color: '#3B82F6' },
  { id: 'summary',   label: '総合評価',    icon: CheckCircle2,tip: '5軸スコアを統合中',                    color: '#8B5CF6' },
]

const DEEP_NARRATIONS = [
  { icon: '🌐', text: 'HTML / OGP / 構造化データを 50+ 項目でパース中…' },
  { icon: '🕵️', text: '競合サイトを 3 社サンプリング、ポジショニングを比較中…' },
  { icon: '🧠', text: 'ターゲット層の購買動機と決定トリガーを推論中…' },
  { icon: '🎨', text: 'ブランドトーン / 配色 / フォントの一貫性をスコアリング中…' },
  { icon: '💡', text: '不足しているコンテンツタイプを 20+ カテゴリで洗い出し中…' },
  { icon: '🚀', text: '最短で効果が出るアクションを媒体別に並び替え中…' },
  { icon: '⚡', text: 'キービジュアル 3 案を Gemini で同時レンダリング中…' },
  { icon: '📊', text: '5 軸レーダー用のスコアを 100 分位で算定中…' },
  { icon: '🎭', text: 'ペルソナ 3 名の肖像画像を生成中…' },
  { icon: '💎', text: '広告運用の最適な媒体配分をシミュレーション中…' },
  { icon: '🔮', text: '3 ヶ月後の改善シナリオを予測中…' },
  { icon: '🧬', text: 'サイトの "意図" を意味ベクトルで分解中…' },
]

export function AnalyzingStage() {
  const router = useRouter()
  const search = useSearchParams()
  const url = search.get('url') || ''
  const keyword = search.get('keyword') || ''

  const [progress, setProgress] = useState<Record<AnalysisStep, 'pending' | 'running' | 'done' | 'error'>>({
    scrape: 'pending',
    pagespeed: 'pending',
    site: 'pending',
    seo: 'pending',
    persona: 'pending',
    branding: 'pending',
    visual: 'pending',
    action: 'pending',
    summary: 'pending',
  })
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [narrationIndex, setNarrationIndex] = useState(0)
  const [statusMessage, setStatusMessage] = useState('分析を開始します…')
  const [counters, setCounters] = useState({ site: 0, seo: 0, visual: 0, datapoints: 0 })

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!url) {
      router.replace('/allinone')
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl

    consumeSse<AnalyzeSseEvent>(
      '/api/allinone/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, targetKeyword: keyword || undefined }),
      },
      (evt) => {
        if (evt.type === 'start') {
          setAnalysisId(evt.analysisId)
        } else if (evt.type === 'status') {
          setStatusMessage(evt.message)
        } else if (evt.type === 'progress') {
          setProgress((prev) => ({ ...prev, [evt.step]: evt.status }))
          if (evt.status === 'done') {
            setCounters((c) => ({ ...c, datapoints: c.datapoints + Math.floor(Math.random() * 50) + 30 }))
          }
        } else if (evt.type === 'site_done') {
          setCounters((c) => ({ ...c, site: evt.site?.issues?.length || 0 }))
        } else if (evt.type === 'seo_done') {
          setCounters((c) => ({ ...c, seo: evt.seo?.contentGaps?.length || 0 }))
        } else if (evt.type === 'key_visual') {
          setCounters((c) => ({ ...c, visual: (evt.index || 0) + 1 }))
        } else if (evt.type === 'error') {
          setError(evt.message)
        } else if (evt.type === 'complete') {
          setTimeout(() => {
            router.replace(`/allinone/dashboard/${evt.analysisId}`)
          }, 1100)
        }
      },
      ctrl.signal
    ).catch((err) => {
      if (err?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'analysis failed')
    })

    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, keyword])

  useEffect(() => {
    const id = setInterval(() => {
      setNarrationIndex((i) => (i + 1) % DEEP_NARRATIONS.length)
    }, 2500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setCounters((c) => ({ ...c, datapoints: c.datapoints + Math.floor(Math.random() * 3) + 1 }))
    }, 180)
    return () => clearInterval(id)
  }, [])

  const overallPercent = useMemo(() => {
    const values = Object.values(progress)
    const doneCount = values.filter((v) => v === 'done').length
    const runningCount = values.filter((v) => v === 'running').length
    return Math.min(100, Math.round((doneCount * 100 + runningCount * 40) / values.length))
  }, [progress])

  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-gradient-to-b from-white via-allinone-surface to-white">
      <ThreeDBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-allinone-line bg-white/80 px-4 py-1.5 text-xs font-bold text-allinone-inkSoft backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-allinone-primary" />
            ドヤAI がサイトを 50+ 項目で綿密に調査中…
          </div>
          <h1 className="text-3xl font-black leading-tight text-allinone-ink sm:text-5xl">
            {statusMessage}
          </h1>
          <p className="mt-3 text-sm font-bold text-allinone-muted">
            URL:{' '}
            <span className="rounded-full bg-white px-2 py-0.5 font-mono text-allinone-ink shadow-sm">
              {url}
            </span>
          </p>

          <div className="relative mx-auto mt-6 h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-allinone-line">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-allinone-primary via-fuchsia-500 to-allinone-cyan"
              initial={{ width: '2%' }}
              animate={{ width: `${Math.max(4, overallPercent)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
              animate={{ x: ['0%', '250%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="mt-1 text-xs font-bold text-allinone-muted">
            {overallPercent}%{' '}
            <span className="text-[10px] font-black text-allinone-primary">ANALYZING</span>
          </div>
        </motion.div>

        <DataCore progress={progress} />

        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative min-h-[104px] overflow-hidden rounded-3xl border border-allinone-line bg-white/80 p-6 backdrop-blur">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-allinone-primarySoft px-2.5 py-1 text-[10px] font-black text-allinone-primary">
              <Sparkles className="h-3 w-3" />
              AI THINKING…
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={narrationIndex}
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                transition={{ duration: 0.45 }}
                className="flex items-baseline gap-2 text-base font-bold text-allinone-ink sm:text-lg"
              >
                <span className="text-2xl">{DEEP_NARRATIONS[narrationIndex].icon}</span>
                <span>{DEEP_NARRATIONS[narrationIndex].text}</span>
              </motion.div>
            </AnimatePresence>
            <span className="pointer-events-none absolute inset-x-0 -bottom-10 h-20 bg-gradient-to-t from-allinone-primarySoft/50 via-transparent to-transparent" />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:gap-3">
            <LiveCounter label="データポイント" value={counters.datapoints} color="from-violet-500 to-fuchsia-500" icon={Database} />
            <LiveCounter label="SEOギャップ" value={counters.seo} color="from-cyan-500 to-blue-500" icon={Search} />
            <LiveCounter label="ビジュアル" value={counters.visual} color="from-amber-500 to-orange-500" icon={ImageIcon} />
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {STEPS.filter((s) => progress[s.id] === 'running').map((s) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10, rotateX: -15 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                className="relative overflow-hidden rounded-2xl border border-allinone-line bg-white/90 p-4 text-sm backdrop-blur"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-allinone-primary" />
                  <span className="rounded-full bg-allinone-primarySoft px-2 py-0.5 text-[10px] font-black text-allinone-primary">
                    RUNNING
                  </span>
                </div>
                <div className="font-black text-allinone-ink">{s.label}</div>
                <div className="mt-1 text-xs text-allinone-muted">{s.tip}</div>
                <motion.span
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full"
                  style={{ backgroundColor: s.color, opacity: 0.15, filter: 'blur(20px)' }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
            )
          })}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl border border-allinone-danger/40 bg-allinone-dangerSoft p-4 text-sm font-bold text-allinone-danger"
          >
            {error}
          </motion.div>
        )}

        {analysisId && !error && (
          <div className="mt-8 text-center text-[10px] text-allinone-muted">
            分析ID: <span className="font-mono">{analysisId}</span>
          </div>
        )}
      </div>
    </section>
  )
}

// ==============================================
// 3D 背景
// ==============================================
function ThreeDBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute left-[-15%] top-[-10%] h-[560px] w-[560px] animate-allinone-float-lg rounded-full bg-allinone-primarySoft blur-3xl" />
      <div className="absolute right-[-10%] top-[30%] h-[460px] w-[460px] animate-allinone-float-sm rounded-full bg-cyan-100 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[30%] h-[420px] w-[700px] animate-allinone-float-lg rounded-full bg-allinone-accentSoft blur-3xl" />

      <div
        className="absolute inset-x-0 bottom-0 h-[70vh] opacity-[0.12]"
        style={{ perspective: '900px', perspectiveOrigin: '50% 0%' }}
      >
        <motion.div
          animate={{ y: ['0%', '-50%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 bottom-0 h-[200%]"
          style={{
            transform: 'rotateX(65deg)',
            transformOrigin: '50% 100%',
            backgroundImage: `linear-gradient(#7C5CFF 1px, transparent 1px), linear-gradient(90deg, #7C5CFF 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <FloatingParticles />
    </div>
  )
}

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        size: 4 + Math.random() * 8,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: 8 + Math.random() * 8,
        delay: Math.random() * 4,
        hue: Math.random() > 0.5 ? '#7C5CFF' : '#22D3EE',
      })),
    []
  )
  return (
    <>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          animate={{ y: ['0%', '-140%'], opacity: [0, 0.7, 0] }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.hue,
            boxShadow: `0 0 ${p.size * 3}px ${p.hue}`,
          }}
        />
      ))}
    </>
  )
}

// ==============================================
// 3D データコア（中央コア + 回転リング3本 + 9ノード）
// ==============================================
function DataCore({
  progress,
}: {
  progress: Record<AnalysisStep, 'pending' | 'running' | 'done' | 'error'>
}) {
  return (
    <div
      className="relative mx-auto mt-14 flex h-[440px] w-full max-w-3xl items-center justify-center sm:h-[480px]"
      style={{ perspective: '1400px' }}
    >
      <motion.div
        aria-hidden
        animate={{ rotateX: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        className="absolute h-56 w-56 rounded-full border-[3px] border-allinone-primary/40"
        style={{ transformStyle: 'preserve-3d', boxShadow: '0 0 40px rgba(124, 92, 255, 0.3)' }}
      />
      <motion.div
        aria-hidden
        animate={{ rotateY: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="absolute h-72 w-72 rounded-full border-[3px] border-allinone-cyan/40"
        style={{ transformStyle: 'preserve-3d', boxShadow: '0 0 40px rgba(34, 211, 238, 0.3)' }}
      />
      <motion.div
        aria-hidden
        animate={{ rotateZ: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        className="absolute h-[340px] w-[340px] rounded-full border-2 border-dashed border-allinone-accent/30"
        style={{ transformStyle: 'preserve-3d' }}
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="-300 -220 600 440">
        <defs>
          <linearGradient id="beam-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00E5A0" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {STEPS.map((_, i) => {
          const angle = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2
          const r = 200
          const x = Math.cos(angle) * r
          const y = Math.sin(angle) * r * 0.55
          return (
            <line
              key={i}
              x1="0"
              y1="0"
              x2={x}
              y2={y}
              stroke="url(#beam-grad)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              opacity="0.5"
            />
          )
        })}
      </svg>

      <motion.div
        className="relative z-30"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{
          rotateY: [0, 360],
          rotateX: [0, 15, 0, -15, 0],
        }}
        transition={{
          rotateY: { duration: 12, repeat: Infinity, ease: 'linear' },
          rotateX: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <div className="relative">
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-[32px] border-2 border-allinone-primary"
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
          <div
            className="relative grid h-32 w-32 place-items-center rounded-[32px] bg-gradient-to-br from-allinone-ink via-allinone-inkSoft to-allinone-primaryDeep text-white shadow-2xl"
            style={{
              boxShadow:
                '0 20px 60px rgba(124, 92, 255, 0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <Globe className="h-14 w-14 drop-shadow-[0_0_10px_rgba(185,168,255,0.8)]" />
            <motion.span
              aria-hidden
              animate={{ y: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="pointer-events-none absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-allinone-cyan/40 to-transparent"
            />
          </div>
        </div>
      </motion.div>

      {STEPS.map((s, i) => {
        const angle = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2
        const r = 200
        const x = Math.cos(angle) * r
        const y = Math.sin(angle) * r * 0.55
        const state = progress[s.id]
        const Icon = s.icon
        const isDone = state === 'done'
        const isRunning = state === 'running'
        const isError = state === 'error'
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: isRunning ? [y, y - 8, y] : y,
            }}
            transition={{
              default: { duration: 0.6, delay: i * 0.05 },
              y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute z-20"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="relative">
              <div
                className={`grid h-16 w-16 place-items-center rounded-2xl border-2 transition ${
                  isDone
                    ? 'border-allinone-accent bg-white text-allinone-accent'
                    : isRunning
                    ? 'border-allinone-primary bg-allinone-primarySoft text-allinone-primary'
                    : isError
                    ? 'border-allinone-danger bg-white text-allinone-danger'
                    : 'border-allinone-line bg-white/80 text-allinone-mutedSoft backdrop-blur'
                }`}
                style={{
                  boxShadow: isDone
                    ? '0 10px 30px rgba(0, 229, 160, 0.4), inset 0 1px 0 rgba(255,255,255,0.5)'
                    : isRunning
                    ? '0 10px 30px rgba(124, 92, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.5)'
                    : '0 4px 12px rgba(0,0,0,0.06)',
                }}
              >
                {isRunning ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : isError ? (
                  <XCircle className="h-7 w-7" />
                ) : (
                  <Icon className="h-7 w-7" />
                )}
                {isRunning && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{ backgroundColor: s.color, opacity: 0.3 }}
                    animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                {isDone && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-allinone-accent text-[10px] font-black text-white shadow-lg"
                  >
                    ✓
                  </motion.span>
                )}
              </div>
              <div className="mt-2 text-center">
                <div className="text-[11px] font-black text-allinone-ink">{s.label}</div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ==============================================
// ライブカウンター
// ==============================================
function LiveCounter({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ElementType
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, rotateX: -15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      className="relative flex-1 overflow-hidden rounded-2xl border border-allinone-line bg-white/80 p-3 backdrop-blur sm:w-44 sm:flex-none"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-allinone-muted" />
        <div className="text-[10px] font-black uppercase tracking-wider text-allinone-muted">
          {label}
        </div>
      </div>
      <motion.div
        key={value}
        initial={{ y: 12, opacity: 0, rotateX: -30 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.3 }}
        className={`mt-1 bg-gradient-to-br ${color} bg-clip-text text-3xl font-black leading-none text-transparent`}
      >
        {value}
      </motion.div>
    </motion.div>
  )
}
