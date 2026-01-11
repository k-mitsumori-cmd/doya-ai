'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { ChevronRight, ScanSearch, ExternalLink, CheckCircle2 } from 'lucide-react'

export type MotionMode = 'party' | 'minimal'
export type OverlayMood = 'idle' | 'search' | 'think' | 'happy'

export function usePersonaMotionMode(): MotionMode {
  // NOTE:
  // Next.jsのプリレンダーで useSearchParams() をページ直下で使うと
  // "should be wrapped in a suspense boundary" エラーになり得るため、
  // ここでは query はクライアントで window.location.search から読む。
  const env = (process.env.NEXT_PUBLIC_MOTION_MODE || '').toLowerCase()
  const envDefault: MotionMode = env === 'minimal' ? 'minimal' : 'party' // default: party

  const [mode, setMode] = useState<MotionMode>(envDefault)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const q = new URLSearchParams(window.location.search).get('motion')?.toLowerCase()
      if (q === 'minimal') setMode('minimal')
      else if (q === 'party') setMode('party')
      else setMode(envDefault)
    } catch {
      setMode(envDefault)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return mode
}

export const pageMount = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

export const cardMount = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

export const navMountDelayed = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const, delay: 0.1 } },
}

export const stagger = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
}

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

export function ctaMotion(mode: MotionMode) {
  return {
    whileHover: mode === 'party' ? { scale: 1.03, rotate: -0.4 } : { scale: 1.02 },
    whileTap: mode === 'party' ? { scale: 0.96, rotate: 0.8 } : { scale: 0.98 },
    transition: { duration: 0.15, ease: 'easeOut' as const },
  }
}

export function useConfettiOnComplete(args: { enabled: boolean; when: boolean }) {
  const firedRef = useRef(false)
  useEffect(() => {
    if (!args.enabled) return
    if (!args.when) return
    if (firedRef.current) return
    firedRef.current = true
    confetti({
      particleCount: 140,
      spread: 95,
      origin: { y: 0.55 },
      colors: ['#a855f7', '#ec4899', '#60a5fa', '#f59e0b'],
    })
    // 次回の完了でまた打てるように少し遅らせて解除
    const t = window.setTimeout(() => {
      firedRef.current = false
    }, 1200)
    return () => window.clearTimeout(t)
  }, [args.enabled, args.when])
}

function PartyBackground({ enabled }: { enabled: boolean }) {
  if (!enabled) return null
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-white" />
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

export function PartyLoadingOverlay({
  open,
  mode,
  progress,
  stageText,
  mood,
  steps,
  mascotSrc = '/persona/mascot.svg',
  title = 'ペルソナ生成中',
  cards,
  showSpec = false,
  estimatedSeconds,
  allowTabSwitch = false,
}: {
  open: boolean
  mode: MotionMode
  progress: number
  stageText: string
  mood: OverlayMood
  steps: { label: string; threshold: number }[]
  mascotSrc?: string
  title?: string
  cards?: { title: string; subtitle: string }[]
  showSpec?: boolean
  estimatedSeconds?: number | null
  allowTabSwitch?: boolean
}) {
  const p = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  const party = mode === 'party'
  const [pulse, setPulse] = useState(0)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)

  // progressが止まって見えないよう、微小な"動いてる感"を付与（partyのみ）
  useEffect(() => {
    if (!open || !party) return
    const t = window.setInterval(() => setPulse((v) => (v + 1) % 1000), 800)
    return () => window.clearInterval(t)
  }, [open, party])

  // カウントダウンの実装（1秒ごとに更新、アニメーションなしで数字だけ減る）
  useEffect(() => {
    if (estimatedSeconds === null || estimatedSeconds === undefined) {
      setCountdownSeconds(null)
      return
    }

    // 初期値を設定
    setCountdownSeconds(estimatedSeconds)

    // 1秒ごとにカウントダウン（アニメーションなしで数字だけ減る）
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev === undefined) return null
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [estimatedSeconds])

  // estimatedSecondsが更新されたら、countdownSecondsも更新
  useEffect(() => {
    if (estimatedSeconds !== null && estimatedSeconds !== undefined) {
      // 新しい推定時間が現在のカウントダウンより大きい場合のみ更新
      // （進捗が早い場合、残り時間が増えることがあるため）
      setCountdownSeconds((prev) => {
        if (prev === null || prev === undefined) return estimatedSeconds
        // 新しい推定時間が現在のカウントダウンより大きい場合のみ更新
        if (estimatedSeconds > prev) return estimatedSeconds
        return prev
      })
    }
  }, [estimatedSeconds])

  const mascotAnim = useMemo(() => {
    if (!party) return { rotate: 0, y: 0 }
    if (mood === 'happy') return { rotate: [0, 8, -8, 0], y: [0, -2, 0] }
    if (mood === 'search') return { rotate: [0, -2, 2, 0], y: [0, -4, 0] }
    if (mood === 'think') return { rotate: 0, y: [0, -2, 0] }
    return { rotate: 0, y: 0 }
  }, [party, mood])

  return (
    <>
      <PartyBackground enabled={open && party} />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/10 backdrop-blur-md shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
                      animate={{ opacity: 1, scale: 1, ...mascotAnim }}
                      transition={{
                        duration: party ? 0.7 : 0.2,
                        repeat: party && mood !== 'idle' ? Infinity : 0,
                        repeatType: 'mirror',
                        ease: 'easeInOut',
                      }}
                      className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden"
                      title="Mascot"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mascotSrc} alt="mascot" className="w-11 h-11 object-contain" />
                    </motion.div>
                    <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center">
                      <ScanSearch className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-black text-lg leading-tight">{title}</div>
                      <div className="text-white/70 text-xs font-bold mt-1">{stageText}</div>
                      {countdownSeconds !== null && countdownSeconds !== undefined && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-400/50 backdrop-blur-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          <div className="text-white font-black text-sm">
                            残り時間:{' '}
                            <span className="text-purple-200">
                              {countdownSeconds > 0 ? (
                                <>
                                  {Math.floor(countdownSeconds / 60) > 0 && (
                                    <>{Math.floor(countdownSeconds / 60)}分</>
                                  )}
                                  {countdownSeconds % 60}秒
                                </>
                              ) : (
                                'まもなく完了'
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                      {allowTabSwitch && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/90 to-teal-500/90 border-2 border-emerald-400/80 backdrop-blur-sm shadow-lg shadow-emerald-500/20"
                        >
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </motion.div>
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-white" />
                            <div className="text-white font-black text-sm leading-tight">
                              別タブに切り替えても<br className="sm:hidden" />
                              <span className="text-emerald-100">処理は続行されます</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                </div>

                {/* Flow indicator（迷わない/流れで考える） */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {steps.map((s, i) => {
                    const active = p >= s.threshold
                    return (
                      <div key={`${s.label}-${i}`} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-white' : 'bg-white/25'}`} />
                        <div className={`text-[11px] font-black ${active ? 'text-white' : 'text-white/50'}`}>{s.label}</div>
                        {i < steps.length - 1 && <div className="w-6 h-px bg-white/15" />}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                  />
                </div>
              </div>

              <div className="p-6">
                <div className="grid sm:grid-cols-3 gap-3">
                  {(cards || [
                    { title: '候補を抽出', subtitle: '生成の"手触り"を出すための演出' },
                    { title: '履歴書を生成', subtitle: '生成の"手触り"を出すための演出' },
                    { title: '生活を描写', subtitle: '生成の"手触り"を出すための演出' },
                  ]).map((card, i) => (
                    <motion.div
                      key={`${card.title}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3, ease: 'easeOut' }}
                      className="rounded-2xl bg-white/10 border border-white/10 p-4"
                    >
                      <div className="text-white font-black">{card.title}</div>
                      <div className="mt-1 text-white/70 text-xs font-bold">{card.subtitle}</div>
                      {party && (
                        <motion.div
                          className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden"
                        >
                          <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: ['0%', '30%', '60%', '100%', '0%'] }}
                            transition={{ 
                              duration: 3, 
                              repeat: Infinity, 
                              ease: 'easeInOut',
                              repeatDelay: 0.3
                            }}
                            className="h-full bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full"
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {showSpec && (
                  <div className="mt-5 text-white/70 text-xs font-bold">
                    仕様：partyデフォルト / 機能非干渉（表示層のみ）
                    <span className="ml-2 inline-flex items-center gap-1 text-white/80">
                      docs <ChevronRight className="w-4 h-4" /> animation-spec.md
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


