'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Sparkles, ChevronRight, FileText, Home, Settings, Zap, ScanSearch, PartyPopper } from 'lucide-react'

// ==========================================
// /persona/rive-test
// 目的: UIはミニマルに戻し、アニメーション設計だけテストする
// - Next.js App Router想定
// - React + TypeScript
// - Framer Motion
// - テストなので「派手モード」も実装（他ページには影響しない）
// ==========================================

type View = 'form' | 'result'

type Flavor = 'minimal' | 'party'

type Mood = 'idle' | 'search' | 'think' | 'happy'

type Toast = { id: string; title: string; desc?: string }

// ① 初期表示（マウント時）
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

const navVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const, delay: 0.1 } },
}

const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ② 要素の出現順（stagger）
const stagger = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
}

const item = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

// ④ 画面遷移（想定）
const enterNext = { initial: { x: 16, opacity: 0 }, animate: { x: 0, opacity: 1 } }
const exitPrev = { exit: { opacity: 0 } }
const screenTransition = { duration: 0.3, ease: 'easeOut' as const } // spring禁止

function TopNav({
  flavor,
  onToggleFlavor,
}: {
  flavor: Flavor
  onToggleFlavor: () => void
}) {
  return (
    <motion.header variants={navVariants} initial="initial" animate="animate" className="w-full">
      <div className="mx-auto max-w-4xl px-4 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-slate-900 font-black tracking-tight">Doya Persona — UI Test</div>
            <div className="text-[11px] font-bold text-slate-500">
              {flavor === 'party' ? 'PARTY MODE / Interaction Playground' : 'Minimal SaaS / Motion Spec'}
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <motion.button
            onClick={onToggleFlavor}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`h-9 px-3 rounded-xl text-xs font-black inline-flex items-center gap-2 border ${
              flavor === 'party'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-white/20'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="派手モードON/OFF"
          >
            {flavor === 'party' ? <PartyPopper className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            派手モード
          </motion.button>
          <button className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            Home
          </button>
          <button className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 inline-flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>
      </div>
    </motion.header>
  )
}

function PartyBackground({ enabled }: { enabled: boolean }) {
  if (!enabled) return null
  // 派手モード用：動くグラデーション＋パルス（ブラー含む）
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-white"
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-purple-400/30 blur-3xl"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
        className="absolute -bottom-48 -right-48 w-[560px] h-[560px] rounded-full bg-pink-400/30 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -18, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-24 right-20 w-56 h-56 rounded-full bg-amber-300/20 blur-2xl"
      />
    </div>
  )
}

function LoadingOverlay({
  show,
  flavor,
  progress,
  stage,
  mood,
  level,
  xpPct,
  quests,
}: {
  show: boolean
  flavor: Flavor
  progress: number
  stage: string
  mood: Mood
  level: number
  xpPct: number
  quests: { label: string; threshold: number }[]
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              rotate: flavor === 'party' ? [0, 0.2, -0.2, 0] : 0,
            }}
            transition={{
              duration: flavor === 'party' ? 0.6 : 0.3,
              ease: 'easeOut',
              repeat: flavor === 'party' ? Infinity : 0,
              repeatType: 'mirror',
            }}
            className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/10 backdrop-blur-md shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Mascot (inspired placeholder). Replace /public/persona/rive-test/mascot.svg with the provided sprite if needed. */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotate: mood === 'happy' ? [0, 8, -8, 0] : mood === 'search' ? [0, -2, 2, 0] : 0,
                      y: mood === 'search' ? [0, -4, 0] : mood === 'think' ? [0, -2, 0] : 0,
                    }}
                    transition={{
                      duration: mood === 'happy' ? 0.6 : 0.9,
                      repeat: mood === 'happy' || mood === 'search' || mood === 'think' ? Infinity : 0,
                      repeatType: 'mirror',
                      ease: 'easeInOut',
                    }}
                    className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden"
                    title="Mascot"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/persona/rive-test/mascot.svg"
                      alt="mascot"
                      className="w-11 h-11 object-contain"
                    />
                  </motion.div>
                  <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center">
                    <ScanSearch className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-black text-lg leading-tight">ペルソナ生成中</div>
                    <div className="text-white/70 text-xs font-bold mt-1">{stage}</div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              </div>

              {/* Flow indicator (warm + “flow”) */}
              <div className="mt-4 flex items-center gap-2">
                {['解析', '設計', '履歴書', '日記'].map((t, i) => {
                  const active = progress >= [10, 35, 60, 85][i]
                  return (
                    <div key={t} className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          active ? 'bg-white' : 'bg-white/25'
                        }`}
                      />
                      <div className={`text-[11px] font-black ${active ? 'text-white' : 'text-white/50'}`}>{t}</div>
                      {i < 3 && <div className="w-6 h-px bg-white/15" />}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                />
              </div>
            </div>

            <div className="p-6">
              <div className="grid sm:grid-cols-3 gap-3">
                {['候補を抽出', '履歴書を生成', '生活を描写'].map((t, i) => (
                  <motion.div
                    key={t}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3, ease: 'easeOut' }}
                    className="rounded-2xl bg-white/10 border border-white/10 p-4"
                  >
                    <div className="text-white font-black">{t}</div>
                    <div className="mt-1 text-white/70 text-xs font-bold">UIが動いて“作ってる感”を出します</div>
                    {flavor === 'party' && (
                      <motion.div
                        initial={{ x: '-40%' }}
                        animate={{ x: '140%' }}
                        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                        className="mt-3 h-1.5 w-1/2 rounded-full bg-gradient-to-r from-white/10 to-white/50"
                      />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Game-like: Quest log + Level (party only) */}
              {flavor === 'party' && (
                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <div className="text-white/90 text-[11px] font-black tracking-wider">QUEST LOG</div>
                    <div className="mt-2 grid gap-2">
                      {quests.map((q) => {
                        const done = progress >= q.threshold
                        const active = !done && progress + 8 >= q.threshold
                        return (
                          <div
                            key={q.label}
                            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 border ${
                              done
                                ? 'bg-white/15 border-white/20'
                                : active
                                ? 'bg-white/10 border-white/15'
                                : 'bg-transparent border-white/10'
                            }`}
                          >
                            <div className="text-white text-sm font-black">{q.label}</div>
                            <div className="text-white/70 text-xs font-black">
                              {done ? 'COMPLETE' : active ? 'NOW' : `${q.threshold}%`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-white/90 text-[11px] font-black tracking-wider">LEVEL UP</div>
                      <div className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-black">
                        Lv.{level}
                      </div>
                    </div>
                    <div className="mt-2 text-white text-sm font-bold">
                      XP <span className="text-white/70">({Math.round(xpPct)}%)</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${xpPct}%` }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-amber-300 to-pink-300"
                      />
                    </div>
                    <div className="mt-3 text-white/70 text-xs font-bold">
                      ※進捗を「成長」として見せることで、待ち時間を“体験”に変換します。
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 bottom-4 z-[120] w-[320px] max-w-[calc(100vw-32px)] pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 18, y: 6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mb-2 rounded-2xl bg-slate-900 text-white border border-white/10 shadow-2xl px-4 py-3"
          >
            <div className="text-xs font-black tracking-wider text-white/70">ACHIEVEMENT</div>
            <div className="mt-1 text-sm font-black">{t.title}</div>
            {t.desc ? <div className="mt-1 text-xs font-bold text-white/70">{t.desc}</div> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function SparkleTrail({
  enabled,
  sparkles,
}: {
  enabled: boolean
  sparkles: { id: string; x: number; y: number }[]
}) {
  if (!enabled) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[110]">
      <AnimatePresence>
        {sparkles.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ position: 'absolute', left: s.x, top: s.y }}
            className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_18px_rgba(236,72,153,0.45)]"
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  flavor,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  flavor: Flavor
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      // ③ ボタン操作: hover / tap（操作感の最小限の動き）
      whileHover={disabled ? undefined : flavor === 'party' ? { scale: 1.04, rotate: -0.4 } : { scale: 1.02 }}
      whileTap={disabled ? undefined : flavor === 'party' ? { scale: 0.96, rotate: 0.8 } : { scale: 0.98 }}
      transition={{ duration: disabled ? 0 : 0.15, ease: 'easeOut' }}
      className={`h-11 px-4 rounded-2xl text-sm font-black disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
        flavor === 'party'
          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_10px_24px_-10px_rgba(168,85,247,0.6)]'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      }`}
    >
      {children}
    </motion.button>
  )
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <motion.div variants={item} className="space-y-1.5">
      <div className="text-xs font-black text-slate-700">{label}</div>
      <input
        className="w-full h-11 px-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        placeholder={placeholder}
      />
    </motion.div>
  )
}

function MainCard({
  view,
  onSubmit,
  onBack,
  flavor,
  busy,
}: {
  view: View
  onSubmit: () => void
  onBack: () => void
  flavor: Flavor
  busy: boolean
}) {
  const cardFx =
    flavor === 'party'
      ? {
          initial: { opacity: 0, y: 18, scale: 0.96, rotateX: 6, rotateY: -6 },
          animate: { opacity: 1, y: 0, scale: 1, rotateX: 0, rotateY: 0 },
        }
      : cardVariants

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={cardFx as any}
      transition={
        flavor === 'party'
          ? ({ type: 'spring', stiffness: 140, damping: 18 } as any)
          : ({ duration: 0.3, ease: 'easeOut' } as any)
      }
      className="w-full"
      style={flavor === 'party' ? ({ perspective: 900 } as any) : undefined}
    >
      <div className="mx-auto max-w-4xl px-4 pb-10">
        <div
          className={`rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden ${
            flavor === 'party' ? 'shadow-[0_20px_60px_-24px_rgba(2,6,23,0.35)]' : ''
          }`}
        >
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black tracking-wider text-slate-500">B2B SaaS / AI TOOL</div>
                <div className="mt-1 text-xl font-black text-slate-900 tracking-tight">
                  {view === 'form' ? '生成フォーム（テスト）' : '生成結果（遷移テスト）'}
                </div>
                <div className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">
                  {/* なぜこのアニメーションか: 文章は先に出さず、staggerで順番に出して読みやすくする */}
                  {flavor === 'party'
                    ? '派手モードでは、CTA押下に反応するオーバーレイ/進捗/紙吹雪を入れて“楽しい操作感”を検証します。'
                    : 'アニメーション仕様（マウント/遅延/順次出現/hover&tap/画面遷移）を最小構成で検証します。'}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black">
                MOTION SPEC <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {view === 'form' ? (
                <motion.div
                  key="form"
                  {...exitPrev}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={screenTransition}
                >
                  <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
                    <motion.h2 variants={item} className="text-lg font-black text-slate-900">
                      URLまたは詳細入力
                    </motion.h2>
                    <motion.p variants={item} className="text-sm font-bold text-slate-600">
                      {/* なぜこのアニメーションか: 見出し→説明→入力→ボタンの順で集中を作る */}
                      ここでは“同時出現禁止”のため、要素は0.06秒ずつ順番に出ます。
                    </motion.p>
                    <Field label="サイトURL" placeholder="https://example.com" />
                    <Field label="サービス名" placeholder="例：マーケティング支援AI" />
                    <motion.div variants={item} className="pt-1">
                      <PrimaryButton onClick={onSubmit} disabled={busy} flavor={flavor}>
                        <FileText className="w-4 h-4" />
                        {busy ? '生成中…' : '生成を開始（CTA）'}
                      </PrimaryButton>
                    </motion.div>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  {...enterNext}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={screenTransition}
                >
                  <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
                    <motion.h2 variants={item} className="text-lg font-black text-slate-900">
                      生成完了（テスト）
                    </motion.h2>
                    <motion.p variants={item} className="text-sm font-bold text-slate-600">
                      新画面は x:16 → 0 / opacity:0 → 1。旧画面は opacity:1 → 0（easeのみ）。
                    </motion.p>
                    <motion.div variants={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-black text-slate-500 mb-1">Preview</div>
                      <div className="text-slate-900 text-sm font-bold">
                        「操作した感覚」が伝わる最小限の動きで、業務向けの信頼感を保ちます。
                      </div>
                    </motion.div>
                    <motion.div variants={item} className="pt-1 flex gap-2">
                      <PrimaryButton onClick={onBack} disabled={busy} flavor={flavor}>
                        フォームに戻る
                      </PrimaryButton>
                      <button className="h-11 px-4 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-50">
                        もう一つのCTA（ダミー）
                      </button>
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function PersonaRiveTestPage() {
  const [view, setView] = useState<View>('form')
  const [busy, setBusy] = useState(false)
  const [flavor, setFlavor] = useState<Flavor>('party')
  const [progress, setProgress] = useState(18)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sparkles, setSparkles] = useState<{ id: string; x: number; y: number }[]>([])
  const sparkleLock = useRef(0)
  const mood = useMemo<Mood>(() => {
    if (!busy) return 'idle'
    if (progress < 35) return 'search'
    if (progress < 70) return 'think'
    return 'happy'
  }, [busy, progress])
  const stage = useMemo(() => {
    if (progress < 35) return '候補を探しています…'
    if (progress < 65) return '履歴書を生成しています…'
    if (progress < 90) return '生活スケジュールを構築しています…'
    return '最終仕上げ中…'
  }, [progress])
  const timerRef = useRef<number | null>(null)
  const lastQuestRef = useRef<number>(-1)

  const quests = useMemo(() => {
    return [
      { label: '解析を完了', threshold: 20 },
      { label: '人物設計を完了', threshold: 45 },
      { label: '履歴書を作成', threshold: 70 },
      { label: '日記を仕上げ', threshold: 92 },
    ]
  }, [])

  const level = useMemo(() => 1 + Math.floor(progress / 25), [progress])
  const xpPct = useMemo(() => ((progress % 25) / 25) * 100, [progress])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  // Quest達成トースト（partyのみ）
  useEffect(() => {
    if (flavor !== 'party' || !busy) return
    const idx = quests.findIndex((q) => progress < q.threshold)
    const doneIdx = idx === -1 ? quests.length - 1 : idx - 1
    if (doneIdx >= 0 && doneIdx !== lastQuestRef.current) {
      lastQuestRef.current = doneIdx
      const q = quests[doneIdx]
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setToasts((prev) => [{ id, title: `Quest Complete: ${q.label}`, desc: `進捗 ${q.threshold}% 達成` }, ...prev].slice(0, 3))
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200)
    }
  }, [busy, flavor, progress, quests])

  // CTA押下の「操作感」テスト（派手モードでは演出を増やす）
  const start = () => {
    if (busy) return
    setBusy(true)
    setProgress(12)
    lastQuestRef.current = -1
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setProgress((p) => Math.min(96, p + Math.floor(Math.random() * 9 + 5)))
    }, 260)

    setTimeout(() => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      setProgress(100)
      setView('result')
      setBusy(false)
      if (flavor === 'party') {
        // 仕上げの紙吹雪（控えめではなく“楽しい”を優先）
        confetti({
          particleCount: 140,
          spread: 95,
          origin: { y: 0.55 },
          colors: ['#a855f7', '#ec4899', '#60a5fa', '#f59e0b'],
        })
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
        setToasts((prev) => [{ id, title: 'Persona Ready!', desc: '報酬：レポートUIが解放されました' }, ...prev].slice(0, 3))
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600)
      }
    }, flavor === 'party' ? 1200 : 450)
  }

  const submit = useMemo(() => (busy ? () => {} : start), [busy])

  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-white"
      onPointerMove={(e) => {
        if (flavor !== 'party') return
        const now = Date.now()
        if (now - sparkleLock.current < 40) return
        sparkleLock.current = now
        const id = `${now}-${Math.random().toString(16).slice(2)}`
        const x = (e as any).clientX as number
        const y = (e as any).clientY as number
        setSparkles((prev) => {
          const next = [{ id, x, y }, ...prev].slice(0, 14)
          return next
        })
        window.setTimeout(() => {
          setSparkles((prev) => prev.filter((s) => s.id !== id))
        }, 350)
      }}
    >
      <PartyBackground enabled={flavor === 'party'} />
      <TopNav flavor={flavor} onToggleFlavor={() => setFlavor((v) => (v === 'party' ? 'minimal' : 'party'))} />

      <div className="pt-2">
        <MainCard view={view} onSubmit={submit} onBack={() => setView('form')} flavor={flavor} busy={busy} />
      </div>

      <div className="pb-10">
        <div className="mx-auto max-w-4xl px-4 text-xs font-bold text-slate-400">
          ※このページはアニメーション検証用です（UIは最小構成）。派手モードでは演出を解禁して操作の楽しさを優先します。
        </div>
      </div>

      <LoadingOverlay
        show={busy}
        flavor={flavor}
        progress={progress}
        stage={stage}
        mood={mood}
        level={level}
        xpPct={xpPct}
        quests={quests}
      />
      <ToastStack toasts={toasts} />
      <SparkleTrail enabled={flavor === 'party'} sparkles={sparkles} />
    </motion.main>
  )
}


