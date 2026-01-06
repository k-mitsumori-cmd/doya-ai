'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, ChevronRight, FileText, Home, Settings } from 'lucide-react'

// ==========================================
// /persona/rive-test
// 目的: UIはミニマルに戻し、アニメーション設計だけテストする
// - Next.js App Router想定
// - React + TypeScript
// - Framer Motion
// - 業務向け/信頼感/派手すぎない
// ==========================================

type View = 'form' | 'result'

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

function TopNav() {
  return (
    <motion.header variants={navVariants} initial="initial" animate="animate" className="w-full">
      <div className="mx-auto max-w-4xl px-4 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-slate-900 font-black tracking-tight">Doya Persona — UI Test</div>
            <div className="text-[11px] font-bold text-slate-500">Minimal SaaS / Motion Spec</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
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

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      // ③ ボタン操作: hover / tap（操作感の最小限の動き）
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: disabled ? 0 : 0.15, ease: 'easeOut' }}
      className="h-11 px-4 rounded-2xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
}: {
  view: View
  onSubmit: () => void
  onBack: () => void
}) {
  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate" className="w-full">
      <div className="mx-auto max-w-4xl px-4 pb-10">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black tracking-wider text-slate-500">B2B SaaS / AI TOOL</div>
                <div className="mt-1 text-xl font-black text-slate-900 tracking-tight">
                  {view === 'form' ? '生成フォーム（テスト）' : '生成結果（遷移テスト）'}
                </div>
                <div className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">
                  {/* なぜこのアニメーションか: 文章は先に出さず、staggerで順番に出して読みやすくする */}
                  アニメーション仕様（マウント/遅延/順次出現/hover&tap/画面遷移）を最小構成で検証します。
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
                      <PrimaryButton onClick={onSubmit}>
                        <FileText className="w-4 h-4" />
                        生成を開始（CTA）
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
                      <PrimaryButton onClick={onBack}>フォームに戻る</PrimaryButton>
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

  // CTA押下の「操作感」テスト（派手にせず、短時間だけbusyにする）
  const start = () => {
    if (busy) return
    setBusy(true)
    setTimeout(() => {
      setView('result')
      setBusy(false)
    }, 450)
  }

  const submit = useMemo(() => (busy ? () => {} : start), [busy])

  return (
    <motion.main variants={pageVariants} initial="initial" animate="animate" className="min-h-screen bg-white">
      <TopNav />

      <div className="pt-2">
        <MainCard view={view} onSubmit={submit} onBack={() => setView('form')} />
      </div>

      <div className="pb-10">
        <div className="mx-auto max-w-4xl px-4 text-xs font-bold text-slate-400">
          ※このページはアニメーション検証用です（UIは最小構成）。派手な演出（3D/ブラー/バウンド）は意図的に避けています。
        </div>
      </div>
    </motion.main>
  )
}


