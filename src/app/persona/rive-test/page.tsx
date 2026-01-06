'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Activity,
  Sparkles,
  FileText,
  Search,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
  Gauge,
} from 'lucide-react'

type Severity = 'low' | 'medium' | 'high'
type Status = 'running' | 'done' | 'warning'

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/70 border border-slate-200 text-slate-700 text-[11px] font-black">
      {label}
    </span>
  )
}

function StatCard({
  title,
  value,
  sub,
  icon,
  tone,
}: {
  title: string
  value: string
  sub: string
  icon: React.ReactNode
  tone: 'purple' | 'emerald' | 'amber'
}) {
  const toneCls =
    tone === 'purple'
      ? 'from-purple-600 to-pink-600'
      : tone === 'emerald'
      ? 'from-emerald-600 to-teal-600'
      : 'from-amber-500 to-orange-500'
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className={`px-4 py-3 bg-gradient-to-r ${toneCls} text-white`}>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black tracking-wider opacity-90">{title}</div>
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="mt-2 text-2xl font-black leading-none">{value}</div>
        <div className="mt-1 text-xs font-bold opacity-90">{sub}</div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="text-xs font-bold text-slate-500">詳細を見る</div>
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </div>
    </motion.div>
  )
}

function Progress({ value }: { value: number }) {
  const v = clamp(value, 0, 100)
  return (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ type: 'spring', stiffness: 110, damping: 18 }}
        className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
      />
    </div>
  )
}

function StageRow({ idx, title, desc, status }: { idx: number; title: string; desc: string; status: Status }) {
  const icon =
    status === 'done' ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
    ) : status === 'warning' ? (
      <AlertTriangle className="w-5 h-5 text-amber-600" />
    ) : (
      <div className="w-5 h-5 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
    )
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700">
        {idx}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="font-black text-slate-900">{title}</div>
          {icon}
        </div>
        <div className="mt-1 text-xs font-bold text-slate-500 leading-relaxed">{desc}</div>
      </div>
    </div>
  )
}

function ElementTile({ label, sub }: { label: string; sub: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4"
    >
      <div className="text-slate-900 font-black">{label}</div>
      <div className="mt-1 text-xs font-bold text-slate-500">{sub}</div>
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="h-full w-1/2 bg-gradient-to-r from-purple-600/30 to-pink-600/30"
        />
      </div>
    </motion.div>
  )
}

export default function PersonaRiveTestPage() {
  const [running, setRunning] = useState(true)
  const [risk, setRisk] = useState<Severity>('medium')
  const [progress, setProgress] = useState(38)

  const stages = useMemo(() => {
    const p = progress
    const s: Status[] = [
      p >= 10 ? 'done' : 'running',
      p >= 25 ? 'done' : 'running',
      p >= 40 ? 'done' : 'running',
      p >= 55 ? 'done' : 'running',
      p >= 70 ? 'done' : 'running',
      p >= 85 ? (risk === 'high' ? 'warning' : 'done') : 'running',
    ]
    return s
  }, [progress, risk])

  const bg =
    risk === 'low'
      ? 'from-emerald-50 via-white to-teal-50'
      : risk === 'high'
      ? 'from-amber-50 via-white to-rose-50'
      : 'from-purple-50 via-white to-pink-50'

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bg} p-4 lg:p-8`}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-sm overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-black">
                  <Sparkles className="w-4 h-4" />
                  UI / ANIMATION LAB
                </div>
                <h1 className="mt-3 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                  Report-style Dashboard（Rive参考テスト）
                </h1>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip label="参考：Report System" />
                  <Chip label="参考：UI UX elements" />
                  <Chip label="サイドバー以外のみ適用" />
                </div>
                <div className="mt-3 text-sm font-bold text-slate-600 leading-relaxed">
                  このページは、Rive Marketplaceのテイスト（密度の高いカードUI・微アニメ・レポート感）を参考に、
                  framer-motionで再現したテストページです。実Rive素材の埋め込みは未実施です（.rivが必要）。
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search reports…"
                    className="h-11 w-full sm:w-[260px] pl-9 pr-3 rounded-2xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRunning((v) => !v)}
                    className="h-11 px-4 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 inline-flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    {running ? 'Pause' : 'Run'}
                  </button>
                  <button
                    onClick={() => setProgress((p) => (p >= 100 ? 0 : Math.min(100, p + 12)))}
                    className="h-11 px-4 rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm font-black hover:bg-slate-50 inline-flex items-center gap-2"
                  >
                    <Gauge className="w-4 h-4 text-purple-600" />
                    Step
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="grid lg:grid-cols-3 gap-4">
              <StatCard
                title="SYSTEM"
                value={running ? 'RUNNING' : 'PAUSED'}
                sub="report pipeline"
                icon={<Shield className="w-5 h-5" />}
                tone="purple"
              />
              <StatCard
                title="RISK"
                value={risk === 'low' ? 'LOW' : risk === 'high' ? 'HIGH' : 'MEDIUM'}
                sub="heuristic score"
                icon={<AlertTriangle className="w-5 h-5" />}
                tone={risk === 'low' ? 'emerald' : risk === 'high' ? 'amber' : 'purple'}
              />
              <StatCard
                title="REPORTS"
                value="12"
                sub="generated today"
                icon={<FileText className="w-5 h-5" />}
                tone="emerald"
              />
            </div>

            <div className="mt-4 grid lg:grid-cols-12 gap-4">
              {/* Left: roadmap */}
              <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black text-slate-500 tracking-wider">REPORT SYSTEM</div>
                    <div className="text-slate-900 font-black text-lg">生成ロードマップ</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setRisk((r) => (r === 'low' ? 'medium' : r === 'medium' ? 'high' : 'low'))
                      }
                      className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-100 inline-flex items-center gap-2"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Tone
                    </button>
                    <div className="h-9 px-3 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 text-xs font-black inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      LIVE
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <Progress value={running ? progress : Math.min(progress, progress)} />
                  <div className="mt-4 grid gap-4">
                    <StageRow idx={1} title="サイト解析" desc="見出し/本文から価値・文脈を抽出" status={stages[0]} />
                    <StageRow idx={2} title="課題抽出" desc="悩み/不安/摩擦を言語化" status={stages[1]} />
                    <StageRow idx={3} title="意思決定要素" desc="購入条件/反論/裏事情を推定" status={stages[2]} />
                    <StageRow idx={4} title="人物設計" desc="年齢/職業/生活/価値観を具体化" status={stages[3]} />
                    <StageRow idx={5} title="履歴書生成" desc="枠線/項目/密度で“履歴書感”を出す" status={stages[4]} />
                    <StageRow idx={6} title="日記/スケジュール" desc="生活感を補強する文章を生成" status={stages[5]} />
                  </div>

                  <AnimatePresence>
                    {running && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3"
                      >
                        <div className="text-slate-700 text-sm font-bold">
                          現在：<span className="text-slate-900 font-black">UI / Micro-interactions</span> を生成中…
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-black text-purple-700">
                          Preview <ChevronRight className="w-4 h-4" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right: UI elements */}
              <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <div className="text-[11px] font-black text-slate-500 tracking-wider">UI UX ELEMENTS</div>
                  <div className="text-slate-900 font-black text-lg">アニメーション部品（参考再現）</div>
                </div>
                <div className="p-5 grid gap-3">
                  <ElementTile label="Pill Button" sub="hover / press / glow" />
                  <ElementTile label="Loading Bar" sub="spring progress" />
                  <ElementTile label="Card Lift" sub="elevation + blur" />
                  <ElementTile label="Shimmer" sub="subtle sweep" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}


