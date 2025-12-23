'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HelpCircle, X, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'

export type SidebarTourItem = {
  id: string
  label: string
  description: string
  targetSelector: string
  /** 対象が存在しない場合、スポットライト無しで表示する（既定: false） */
  allowMissing?: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function SidebarTour({
  storageKey,
  autoStart,
  items,
  onEnsureExpanded,
}: {
  storageKey: string
  autoStart: boolean
  items: SidebarTourItem[]
  onEnsureExpanded?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [resolvedItems, setResolvedItems] = useState<SidebarTourItem[]>(items)

  const total = resolvedItems.length

  const current = useMemo(() => (step >= 0 && step < resolvedItems.length ? resolvedItems[step] : null), [step, resolvedItems])

  const close = (markSeen: boolean) => {
    setIsOpen(false)
    setStep(0)
    setTargetRect(null)
    if (markSeen) {
      try {
        localStorage.setItem(storageKey, 'true')
      } catch {}
    }
  }

  const open = () => {
    onEnsureExpanded?.()
    // その画面に存在するステップだけに絞る（ただし allowMissing は残す）
    try {
      const filtered = items.filter((it) => it.allowMissing || !!document.querySelector(it.targetSelector))
      setResolvedItems(filtered.length > 0 ? filtered : items)
    } catch {
      setResolvedItems(items)
    }
    setIsOpen(true)
    setStep(0)
  }

  // 初回ログイン時（または初回表示）に自動起動
  useEffect(() => {
    if (!autoStart) return
    try {
      const seen = localStorage.getItem(storageKey)
      if (seen) return
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => open(), 800)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, storageKey])

  // 現在ステップの対象要素を計測してスポットライト表示
  useEffect(() => {
    if (!isOpen || !current) return
    onEnsureExpanded?.()

    let cancelled = false
    let retry = 0
    let raf = 0
    let t: any = null

    const measure = () => {
      if (cancelled) return
      const el = document.querySelector(current.targetSelector) as HTMLElement | null
      if (!el) {
        setTargetRect(null)
        if (current.allowMissing) return
        // 生成後に出る要素などのために少しリトライ
        if (retry < 10) {
          retry += 1
          t = window.setTimeout(measure, 250)
        }
        return
      }

      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {}

      // smooth scroll の完了を少し待ってから座標取得
      t = window.setTimeout(() => {
        if (cancelled) return
        const r = el.getBoundingClientRect()
        setTargetRect({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        })
      }, 220)
    }

    // レイアウト安定後に計測
    raf = requestAnimationFrame(measure)
    const onResize = () => measure()
    const onScroll = () => {
      // スクロール中の再計測はrafで間引く
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (t) window.clearTimeout(t)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll as any)
    }
  }, [isOpen, current, onEnsureExpanded])

  const tooltipPos = useMemo(() => {
    if (!targetRect) return { left: 24, top: 24 }
    const margin = 12
    const width = 360
    const height = 168
    const preferredLeft = targetRect.x + targetRect.w + margin
    const preferredTop = targetRect.y
    const left = clamp(preferredLeft, 16, window.innerWidth - width - 16)
    const top = clamp(preferredTop, 16, window.innerHeight - height - 16)
    return { left, top }
  }, [targetRect])

  return (
    <>
      {/* 右下に常設 */}
      <button
        type="button"
        onClick={open}
        className="fixed right-5 bottom-5 z-[60] w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-2xl shadow-slate-900/20 hover:bg-black transition-colors flex items-center justify-center"
        title="使い方（ガイド）"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] pointer-events-none"
          >
            {/* 背景（クリックで閉じる） */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
              onClick={() => close(true)}
            />

            {/* スポットライト */}
            {targetRect && (
              <div
                className="absolute rounded-2xl border-2 border-white pointer-events-none"
                style={{
                  left: `${Math.max(8, targetRect.x - 6)}px`,
                  top: `${Math.max(8, targetRect.y - 6)}px`,
                  width: `${Math.max(24, targetRect.w + 12)}px`,
                  height: `${Math.max(24, targetRect.h + 12)}px`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                }}
              />
            )}

            {/* ツールチップ */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute w-[360px] max-w-[calc(100vw-32px)] bg-white rounded-3xl shadow-2xl border border-white/30 p-5 pointer-events-auto"
              style={{ left: tooltipPos.left, top: tooltipPos.top }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    機能紹介
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900">{current?.label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => close(true)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
                  aria-label="閉じる"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="mt-2 text-sm text-slate-600 font-bold leading-relaxed">{current?.description}</p>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-[11px] font-black text-slate-400">
                  {step + 1} / {total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black disabled:opacity-40"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    戻る
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (step >= total - 1) close(true)
                      else setStep((s) => Math.min(total - 1, s + 1))
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700"
                  >
                    {step >= total - 1 ? '完了' : '次へ'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


