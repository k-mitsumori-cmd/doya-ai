'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { aioGet, aioSend } from '@/lib/aio/client'
import { ENGINE_LABEL, type EngineId } from '@/lib/aio/types'
import { DoyaKun, sym, type Mood } from '@/components/aio/ui'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

type Tab = 'visibility' | 'sov' | 'citations' | 'recommend'

interface ScanRow { id: string; status: string; awarenessPct: number | null; shareOfVoice: number | null; ownCitationPct: number | null; createdAt: string }
interface Summary {
  totalRuns: number; brandRuns: number; awarenessPct: number; shareOfVoice: number; ownCitationPct: number
  sentiment: { positive: number; neutral: number; negative: number }
  perEngine: { engine: EngineId; awarenessPct: number }[]
  sov: { brand: string; mentions: number; pct: number; isOwn: boolean }[]
  citations: { domain: string; count: number; channel: string; isOwn: boolean }[]
  promptBreakdown: { promptId: string; text: string; perEngine: { engine: EngineId; mentioned: number; total: number }[] }[]
  recommendations?: { title: string; detail: string; priority: string }[]
}

const PURPLE = '#7f19e6'

export default function AioDashboard() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const searchParams = useSearchParams()
  const autoScanTriggered = useRef(false)
  const [tab, setTab] = useState<Tab>('visibility')
  const [scans, setScans] = useState<ScanRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brandName, setBrandName] = useState<string | null>(null)
  const [activePrompts, setActivePrompts] = useState<number | null>(null)
  const [promptTexts, setPromptTexts] = useState<string[]>([])
  // 前回スキャンとの差分（定点観測の肝）。done が2件以上あるときだけ算出
  const [deltas, setDeltas] = useState<{ awareness: number; sov: number; citation: number } | null>(null)
  // 直近のスキャンが失敗していたら通知する
  const [lastFailed, setLastFailed] = useState(false)
  // 有料プランか（false の無料ユーザーにはプロ限定セクションをブラー表示）
  const [isPaid, setIsPaid] = useState(false)

  const load = async () => {
    setError(null)
    try {
      // ブランドプロフィール・プロンプトはダッシュボードの設定アラート/台詞の判定に使う
      const [scanRes, profRes, promptRes, meRes] = await Promise.all([
        aioGet<{ items: ScanRow[] }>('/api/aio/scans', orgSlug),
        aioGet<{ profile: any }>('/api/aio/brand-profile', orgSlug).catch(() => ({ profile: null })),
        aioGet<{ prompts: { text?: string; isActive?: boolean }[] }>('/api/aio/prompts', orgSlug).catch(() => ({ prompts: [] as { text?: string; isActive?: boolean }[] })),
        aioGet<{ plan?: string }>('/api/aio/me', orgSlug).catch(() => ({ plan: 'FREE' })),
      ])
      const plan = (meRes.plan || 'FREE').toUpperCase()
      setIsPaid(plan !== 'FREE' && plan !== 'GUEST')
      setBrandName(profRes.profile?.brandName || null)
      const active = (promptRes.prompts || []).filter((p) => p.isActive !== false)
      setActivePrompts(active.length)
      setPromptTexts(active.map((p) => p.text || '').filter(Boolean))

      const items = scanRes.items || []
      setScans(items)
      // createdAt 降順で並べ替えてから最新の done を選ぶ（古いスナップショットが混ざるのを防ぐ）
      const doneDesc = items
        .filter((s) => s.status === 'done')
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const latest = doneDesc[0]
      const prev = doneDesc[1]
      // 直近スキャン（done/failed 問わず最新）が失敗かどうか
      const newestOverall = items
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      setLastFailed(newestOverall?.status === 'failed')
      // 前回比デルタ（2件以上 done があるとき）
      if (latest && prev) {
        setDeltas({
          awareness: Math.round(((latest.awarenessPct ?? 0) - (prev.awarenessPct ?? 0)) * 10) / 10,
          sov: Math.round(((latest.shareOfVoice ?? 0) - (prev.shareOfVoice ?? 0)) * 10) / 10,
          citation: Math.round(((latest.ownCitationPct ?? 0) - (prev.ownCitationPct ?? 0)) * 10) / 10,
        })
      } else {
        setDeltas(null)
      }
      if (latest) {
        const det = await aioGet<{ scan: any }>(`/api/aio/scans/${latest.id}`, orgSlug)
        setSummary(det.scan?.summary || null)
      } else {
        setSummary(null)
      }
    } catch (e: any) {
      setError(e?.message || 'データの読み込みに失敗しました')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [orgSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  const runScan = async () => {
    setRunning(true)
    setError(null)
    toast.loading('スキャン中…（数分かかります）', { id: 'scan' })
    try {
      await aioSend('/api/aio/scans', orgSlug, 'POST')
      toast.success('スキャン完了', { id: 'scan' })
      await load()
    } catch (e: any) {
      const msg = e?.message || 'スキャンに失敗しました'
      toast.error(msg, { id: 'scan' })
      setError(msg)
    } finally { setRunning(false) }
  }

  const trend = useMemo(
    () => scans.filter((s) => s.status === 'done').slice().reverse().map((s) => ({
      date: new Date(s.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      認知度: s.awarenessPct ?? 0,
      SoV: s.shareOfVoice ?? 0,
    })),
    [scans]
  )

  // ?scan=1 は quick-start 直後の「今すぐスキャンして」という明示要求。
  // 既存doneの有無に関わらず1回だけ実行し、リロードでの二重実行を防ぐためURLからscanを除去する。
  useEffect(() => {
    if (loading || autoScanTriggered.current) return
    if (searchParams.get('scan') !== '1') return
    autoScanTriggered.current = true
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `/aio/${encodeURIComponent(orgSlug)}`)
    if (!running) runScan()
  }, [loading, running, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DashboardSkeleton />

  // ドヤくん（公式マスコット）のひとこと — 状況に応じて表情(mood)と台詞が変化
  const doya: { mood: Mood; message: string } = (() => {
    if (error) return { mood: 'thinking', message: 'うまく読み込めなかったみたい…下のボタンでもう一度試してね' }
    if (!brandName) return { mood: 'hello', message: 'まずはブランド設定を済ませよう！追跡対象を登録すると分析がはじまるよ' }
    if (activePrompts === 0) return { mood: 'point', message: '監視プロンプトがまだ0件だよ。質問を追加してスキャンしてみよう！' }
    if (!summary) return { mood: 'present', message: '準備OK！まずはスキャンしてみよう！' }
    if (summary.awarenessPct >= 60) return { mood: 'success', message: `認知度${summary.awarenessPct}%！AIによく登場してるね、いい感じ！` }
    if (summary.awarenessPct >= 30) return { mood: 'thumbsup', message: `認知度${summary.awarenessPct}%。あと一歩、推奨アクションで伸ばしていこう！` }
    return { mood: 'focus', message: `認知度${summary.awarenessPct}%。AIへの露出はこれから。「推奨」タブを見てみよう！` }
  })()

  // 設定未完了アラート（ブランド未設定・アクティブプロンプト0件）
  const setupBanner = !brandName ? (
    <Link href={`/aio/${orgSlug}/settings`}
      className="relative flex items-center gap-3 mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 pr-24 hover:bg-amber-100/70 transition-colors overflow-hidden">
      <div>
        <div className="flex items-center gap-1.5 text-amber-800 font-black text-sm">{sym('lightbulb')}まず「ブランド設定」を済ませましょう</div>
        <p className="text-xs font-bold text-amber-700/80 mt-1">追跡する自社ブランドと競合を登録すると、AEO分析が正しく動きます。</p>
      </div>
      <DoyaKun mood="point" size={64} className="!absolute -bottom-1 right-3" float={false} />
    </Link>
  ) : activePrompts === 0 ? (
    <Link href={`/aio/${orgSlug}/prompts`}
      className="relative flex items-center gap-3 mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 pr-24 hover:bg-amber-100/70 transition-colors overflow-hidden">
      <div>
        <div className="flex items-center gap-1.5 text-amber-800 font-black text-sm">{sym('add_task')}監視プロンプトを追加しましょう</div>
        <p className="text-xs font-bold text-amber-700/80 mt-1">AIに投げる質問を登録すると、表示状況やシェアを計測できます。</p>
      </div>
      <DoyaKun mood="point" size={64} className="!absolute -bottom-1 right-3" float={false} />
    </Link>
  ) : null

  const errorBanner = error ? (
    <div className="flex items-start gap-3 mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
      <span className="text-rose-500 mt-0.5">{sym('error')}</span>
      <div className="min-w-0 flex-1">
        <div className="text-rose-800 font-black text-sm">読み込みに失敗しました</div>
        <p className="text-xs font-bold text-rose-700/80 mt-1 break-words">{error}</p>
      </div>
      <button onClick={load} disabled={running}
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-black text-xs hover:bg-rose-700 transition-colors disabled:opacity-50">
        {sym('refresh', 16)}再試行
      </button>
    </div>
  ) : null

  // 直近スキャンが失敗していたときの通知（エラー読み込みとは別）
  const failedBanner = !error && lastFailed ? (
    <div className="flex items-start gap-3 mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
      <span className="text-rose-500 mt-0.5 shrink-0">{sym('warning')}</span>
      <div className="min-w-0 flex-1">
        <div className="text-rose-800 font-black text-sm">前回のスキャンは失敗しました</div>
        <p className="text-xs font-bold text-rose-700/80 mt-1 break-words">APIキーの未設定やタイムアウトの可能性があります。もう一度スキャンを実行してください。</p>
      </div>
      <button onClick={runScan} disabled={running}
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-black text-xs hover:bg-rose-700 transition-colors disabled:opacity-50">
        {sym('refresh', 16)}再スキャン
      </button>
    </div>
  ) : null

  const RunButton = (
    <button onClick={runScan} disabled={running}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50">
      <span className="material-symbols-outlined text-[20px]">{running ? 'hourglass_top' : 'play_arrow'}</span>
      {running ? 'スキャン中…' : 'スキャン実行'}
    </button>
  )

  if (!summary) {
    // スキャン実行中（クイックスタート直後の自動スキャン含む）は派手な進捗演出を出す
    if (running) return <ScanProgress brandName={brandName} prompts={promptTexts} />
    return (
      <div className="max-w-2xl mx-auto p-6">
        {errorBanner}
        {failedBanner}
        {setupBanner}
        <div className="text-center">
          <div className="flex justify-center mt-6"><DoyaKun mood={doya.mood} size={120} /></div>
          <div className="inline-block mt-3 rounded-2xl bg-purple-50 border border-purple-100 px-4 py-2 text-sm font-bold text-purple-800">{doya.message}</div>
          <h1 className="text-2xl font-black text-slate-900 mt-3">まだスキャン結果がありません</h1>
          <p className="text-slate-500 font-bold mt-2 mb-6">
            サービス名・URLは登録済みです。下のボタンでAIでの現状をスキャンしましょう（監視する質問は
            <Link href={`/aio/${orgSlug}/prompts`} className="text-purple-700 underline">プロンプト</Link>で編集できます）。
          </p>
          <div className="flex justify-center items-center gap-2 flex-wrap">
            {RunButton}
            <Link href="/aio" className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border-2 border-purple-200 text-purple-700 font-black text-sm hover:bg-purple-50 transition-colors">
              {sym('add', 18)}別のURLを調べる
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <DoyaKun mood={doya.mood} size={56} float={false} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900">AEO ダッシュボード</h1>
            <p className="text-sm font-bold text-purple-700">{doya.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/aio" className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border-2 border-purple-200 text-purple-700 font-black text-sm hover:bg-purple-50 transition-colors">
            {sym('add', 18)}別のURLを調べる
          </Link>
          {RunButton}
        </div>
      </div>

      {errorBanner}
      {failedBanner}
      {setupBanner}

      {/* タブ */}
      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {([['visibility', '表示状況'], ['sov', 'シェア・オブ・ボイス'], ['citations', '引用'], ['recommend', '推奨']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-black whitespace-nowrap border-b-2 transition-colors ${tab === k ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'visibility' && <VisibilityTab summary={summary} trend={trend} delta={deltas?.awareness ?? null} />}
      {tab === 'sov' && <SovTab summary={summary} delta={deltas?.sov ?? null} locked={!isPaid} orgSlug={orgSlug} />}
      {tab === 'citations' && <CitationsTab summary={summary} delta={deltas?.citation ?? null} locked={!isPaid} orgSlug={orgSlug} />}
      {tab === 'recommend' && <RecommendTab summary={summary} locked={!isPaid} orgSlug={orgSlug} />}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-6 animate-pulse">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-6 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-40 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-11 w-36 rounded-xl bg-slate-200" />
      </div>
      <div className="flex gap-2 border-b border-slate-200 mb-5 pb-1">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-7 w-24 rounded-lg bg-slate-200" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`bg-white rounded-2xl border border-slate-200 p-5 ${i >= 2 ? 'md:col-span-2' : ''}`}>
            <div className="h-4 w-40 rounded bg-slate-200 mb-4" />
            <div className="h-40 rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

// スキャン中の派手な進捗演出。実際の監視プロンプト・エンジンを小出しに見せて飽きさせない。
function ScanProgress({ brandName, prompts }: { brandName: string | null; prompts: string[] }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const engines = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity']
  const STEPS = [
    { icon: 'send', label: 'AIに質問を投げています' },
    { icon: 'forum', label: 'AIの回答を読み取っています' },
    { icon: 'leaderboard', label: '競合とのシェアを集計しています' },
    { icon: 'link', label: '引用元ドメインを調べています' },
    { icon: 'tips_and_updates', label: '改善アクションを作成しています' },
  ]
  const stepIdx = Math.min(STEPS.length - 1, Math.floor(tick / 7))
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-tick / 45))))
  const activeEngine = Math.floor(tick / 2) % engines.length
  const currentPrompt = prompts.length ? prompts[Math.floor(tick / 3) % prompts.length] : null
  const TIPS = [
    'AIに引用されるには、比較記事や第三者メディアでの言及が効きます。',
    'ChatGPTとPerplexityでは“推されるサービス”が違うことがよくあります。',
    'スキャンを重ねると、認知度やSoVの推移が時系列で見えるようになります。',
    'FAQや料金を構造化しておくと、AIが回答に引用しやすくなります。',
  ]
  const tip = TIPS[Math.floor(tick / 5) % TIPS.length]

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-purple-700 text-white shadow-xl shadow-purple-500/30 p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="absolute rounded-full bg-white/40 animate-pulse"
              style={{ width: 8 + (i % 3) * 6, height: 8 + (i % 3) * 6, top: `${(i * 37) % 90}%`, left: `${(i * 53) % 90}%`, animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>
        <div className="relative text-center">
          <div className="flex justify-center animate-bounce"><DoyaKun mood="thinking" size={92} /></div>
          <p className="mt-3 text-sm font-black text-purple-100">{brandName ? `「${brandName}」をAIで調査中` : 'AIでの現状を調査中'}</p>
          <div className="text-5xl sm:text-6xl font-black tabular-nums mt-1">{pct}<span className="text-2xl">%</span></div>
          <div className="mt-3 h-3 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 font-black text-sm">
            <span className="material-symbols-outlined text-[18px] animate-pulse">{STEPS[stepIdx].icon}</span>
            {STEPS[stepIdx].label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {engines.map((e, i) => {
          const on = i === activeEngine
          return (
            <div key={e} className={`rounded-xl border p-3 text-center transition-all duration-300 ${on ? 'border-purple-400 bg-purple-50 scale-105 shadow' : 'border-slate-200 bg-white'}`}>
              <p className={`text-xs font-black ${on ? 'text-purple-700' : 'text-slate-400'}`}>{e}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${on ? 'text-purple-500' : 'text-slate-300'}`}>{on ? '質問中…' : '待機'}</p>
            </div>
          )
        })}
      </div>

      {currentPrompt && (
        <div className="mt-4 bg-white rounded-2xl border border-purple-100 p-4">
          <p className="text-[11px] font-black text-purple-500 mb-1">いま調べている質問</p>
          <p key={currentPrompt} className="text-sm font-bold text-slate-800 animate-fade-in-up">「{currentPrompt}」</p>
        </div>
      )}

      <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className={`flex items-center gap-3 text-sm font-bold transition-colors ${i < stepIdx ? 'text-emerald-600' : i === stepIdx ? 'text-purple-700' : 'text-slate-300'}`}>
            <span className="material-symbols-outlined text-[20px]">{i < stepIdx ? 'check_circle' : i === stepIdx ? 'progress_activity' : 'radio_button_unchecked'}</span>
            {s.label}
          </div>
        ))}
      </div>

      <p key={tip} className="mt-4 text-center text-xs font-bold text-slate-400 animate-fade-in-up">💡 {tip}</p>
      <p className="text-center text-[11px] font-bold text-slate-300 mt-2">完了までふつう数分かかります。このままお待ちください。</p>
    </div>
  )
}

function Card({ children, title, className = '' }: { children: React.ReactNode; title?: string; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>
      {title && <h3 className="text-sm font-black text-slate-700 mb-3">{title}</h3>}
      {children}
    </div>
  )
}

function Gauge({ pct, label, delta }: { pct: number; label: string; delta?: number | null }) {
  return (
    <div className="text-center">
      <div className="relative inline-grid place-items-center" style={{ width: 160, height: 160 }}>
        <svg width="160" height="160" className="-rotate-90">
          <circle cx="80" cy="80" r="68" fill="none" stroke="#f1e9fc" strokeWidth="16" />
          <circle cx="80" cy="80" r="68" fill="none" stroke={PURPLE} strokeWidth="16" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 68} strokeDashoffset={2 * Math.PI * 68 * (1 - Math.min(pct, 100) / 100)} />
        </svg>
        <div className="absolute text-center">
          <p className="text-3xl font-black text-slate-900">{pct}%</p>
          {delta != null && <div className="mt-1 flex justify-center"><DeltaBadge value={delta} /></div>}
        </div>
      </div>
      <p className="text-sm font-bold text-slate-500 mt-1">{label}</p>
    </div>
  )
}

// プロ限定セクションのゲート。無料ユーザーには中身にブラーをかけ、
// 「プロでここから先が見れる」案内をオーバーレイ表示する（データ自体は自社のものを表示）。
function ProGate({ locked, orgSlug, children, note }: { locked: boolean; orgSlug: string; children: React.ReactNode; note?: string }) {
  if (!locked) return <>{children}</>
  return (
    <div className="relative">
      <div className="blur-[6px] pointer-events-none select-none" aria-hidden>{children}</div>
      <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/30">
        <Link href={`/aio/pricing`}
          className="flex flex-col items-center gap-2 text-center px-6 py-5 rounded-2xl bg-white/95 border border-purple-200 shadow-lg shadow-purple-500/10 hover:-translate-y-0.5 transition-all">
          <span className="material-symbols-outlined text-purple-600 text-[28px]">lock</span>
          <span className="font-black text-slate-900 text-sm">ここから先はプロプランで閲覧できます</span>
          <span className="text-xs font-bold text-slate-500">{note || 'SoV・引用元・改善アクションなど、AEO改善に効く詳細データが解放されます'}</span>
          <span className="mt-1 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm">プロプランを見る{sym('arrow_forward', 16)}</span>
        </Link>
      </div>
    </div>
  )
}

// 前回スキャンとの差分バッジ（増=緑 / 減=赤 / 変化なし=灰）
function DeltaBadge({ value, suffix = 'pt' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">±0 前回比</span>
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-black px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
      <span className="material-symbols-outlined text-[13px] leading-none">{up ? 'arrow_upward' : 'arrow_downward'}</span>
      {up ? '+' : ''}{value}{suffix} 前回比
    </span>
  )
}

function VisibilityTab({ summary, trend, delta }: { summary: Summary; trend: any[]; delta?: number | null }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card title="ブランド認知度（言及率）">
        <div className="grid place-items-center py-2"><Gauge pct={summary.awarenessPct} label="AIの回答に登場した割合" delta={delta} /></div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {summary.perEngine.map((e) => (
            <div key={e.engine} className="text-center bg-slate-50 rounded-xl py-2">
              <p className="text-[11px] font-bold text-slate-400">{ENGINE_LABEL[e.engine] || e.engine}</p>
              <p className="text-lg font-black text-slate-800">{e.awarenessPct}%</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="認知度・SoVの推移">
        {trend.length <= 1 ? (
          <p className="text-sm text-slate-400 font-bold py-12 text-center">スキャンを重ねると推移が表示されます</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="認知度" stroke={PURPLE} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="SoV" stroke="#e879f9" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="センチメント分析（言及時の論調）" className="md:col-span-2">
        <div className="flex gap-2">
          {([['ポジティブ', summary.sentiment.positive, 'bg-emerald-500'], ['ニュートラル', summary.sentiment.neutral, 'bg-slate-400'], ['ネガティブ', summary.sentiment.negative, 'bg-rose-500']] as [string, number, string][]).map(([label, v, c]) => (
            <div key={label} className="flex-1">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>{label}</span><span>{v}%</span></div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${c}`} style={{ width: `${v}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="プロンプト別の言及頻度" className="md:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-400 font-bold border-b border-slate-100">
              <th className="py-2 pr-3">プロンプト</th>
              {summary.perEngine.map((e) => <th key={e.engine} className="py-2 px-2 text-center whitespace-nowrap">{ENGINE_LABEL[e.engine] || e.engine}</th>)}
            </tr></thead>
            <tbody>
              {summary.promptBreakdown.map((p) => (
                <tr key={p.promptId} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-bold text-slate-700 max-w-xs truncate" title={p.text}>{p.text}</td>
                  {p.perEngine.map((e) => (
                    <td key={e.engine} className="py-2 px-2 text-center">
                      <span className={`font-black ${e.mentioned > 0 ? 'text-purple-700' : 'text-slate-300'}`}>{e.mentioned}/{e.total}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function SovTab({ summary, delta, locked, orgSlug }: { summary: Summary; delta?: number | null; locked: boolean; orgSlug: string }) {
  const data = summary.sov.slice(0, 10).map((s) => ({ name: s.brand, pct: s.pct, isOwn: s.isOwn }))
  return (
    <ProGate locked={locked} orgSlug={orgSlug} note="競合と比較した自社のシェア・オブ・ボイスはプロプランで閲覧できます">
    <div className="grid md:grid-cols-2 gap-4">
      <Card title="シェア・オブ・ボイス">
        {delta != null && <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">自社SoV {summary.shareOfVoice}%<DeltaBadge value={delta} /></div>}
        <table className="w-full text-sm">
          <tbody>
            {summary.sov.slice(0, 10).map((s, i) => (
              <tr key={s.brand} className="border-b border-slate-50">
                <td className="py-2 w-6 text-slate-400 font-bold">{i + 1}</td>
                <td className={`py-2 font-bold ${s.isOwn ? 'text-purple-700' : 'text-slate-700'}`}>{s.brand}{s.isOwn && ' ★'}</td>
                <td className="py-2 text-right font-black text-slate-800">{s.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="占有率（上位10）">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.isOwn ? PURPLE : '#d8b4fe'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
    </ProGate>
  )
}

function CitationsTab({ summary, delta, locked, orgSlug }: { summary: Summary; delta?: number | null; locked: boolean; orgSlug: string }) {
  const channelLabel: Record<string, string> = { own: '自社', media: 'メディア', competitor: '競合', affiliate: 'アフィリエイト', other: 'その他' }
  return (
    <ProGate locked={locked} orgSlug={orgSlug} note="AIがどのサイトを引用しているか・自社の引用率はプロプランで閲覧できます">
    <div className="grid md:grid-cols-2 gap-4">
      <Card title="自社ドメイン引用率">
        <div className="grid place-items-center py-2"><Gauge pct={summary.ownCitationPct} label="AIの引用元に占める自社サイト" delta={delta} /></div>
      </Card>
      <Card title="AIがよく引用するドメイン">
        {summary.citations.length === 0 ? (
          <p className="text-sm text-slate-400 font-bold py-8 text-center">引用元データがありません</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {summary.citations.map((c) => (
                <tr key={c.domain} className="border-b border-slate-50">
                  <td className={`py-2 font-bold ${c.isOwn ? 'text-purple-700' : 'text-slate-700'}`}>{c.domain}{c.isOwn && ' ★'}</td>
                  <td className="py-2 text-slate-400 text-xs font-bold">{channelLabel[c.channel] || c.channel}</td>
                  <td className="py-2 text-right font-black text-slate-800">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
    </ProGate>
  )
}

function RecommendTab({ summary, locked, orgSlug }: { summary: Summary; locked: boolean; orgSlug: string }) {
  const recs = summary.recommendations || []
  const color: Record<string, string> = { high: 'bg-rose-100 text-rose-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' }
  const label: Record<string, string> = { high: '優先度：高', medium: '優先度：中', low: '優先度：低' }
  const body = recs.length === 0 ? (
    <Card><p className="text-slate-400 font-bold text-center py-8">改善アクションがありません</p></Card>
  ) : (
    <div className="space-y-3">
      {recs.map((r, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${color[r.priority] || color.medium}`}>{label[r.priority] || '優先度：中'}</span>
            <h3 className="font-black text-slate-900">{r.title}</h3>
          </div>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">{r.detail}</p>
        </div>
      ))}
    </div>
  )
  return (
    <ProGate locked={locked} orgSlug={orgSlug} note="AEOを伸ばす具体的な改善アクションはプロプランで閲覧できます">
      {body}
    </ProGate>
  )
}
