'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  HelpCircle, 
  X, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  Info,
  Loader2
} from 'lucide-react'

interface FeatureGuideProps {
  featureId: string
  title: string
  description: string
  steps: string[]
  // SEO用途: ガイドはシンプル表示（AI画像生成を使わない）
  imageMode?: 'auto' | 'off'
}

export function FeatureGuide({ featureId, title, description, steps, imageMode = 'auto' }: FeatureGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [guideImage, setGuideImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    // 初めて開くときに画像を生成
    if (imageMode !== 'off' && isOpen && !guideImage && !isLoading) {
      generateImage()
    }
  }, [isOpen, guideImage, isLoading, imageMode, featureId])

  // スライド位置を機能ごとに保存（戻った時に続きから見られる）
  useEffect(() => {
    if (!isOpen) return
    try {
      const key = `doya.featureGuide.${featureId}.page`
      const raw = window.localStorage.getItem(key)
      const n = raw ? Number(raw) : 0
      if (Number.isFinite(n) && n >= 0) setPage(Math.floor(n))
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, featureId])

  useEffect(() => {
    if (!isOpen) return
    try {
      const key = `doya.featureGuide.${featureId}.page`
      window.localStorage.setItem(key, String(page))
    } catch {
      // ignore
    }
  }, [isOpen, featureId, page])

  const generateImage = async () => {
    setIsLoading(true)
    try {
      // ハング対策: 画像生成APIが応答しない場合でもUIが固まらないようtimeout
      const controller = new AbortController()
      const timeoutMs = 12000
      const t = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch('/api/guide/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          featureName: title,
          description: `A professional guide banner for "${title}" feature. ${description}`
        }),
        signal: controller.signal,
      })
      clearTimeout(t)
      const data = await res.json()
      if (data.imageUrl) {
        setGuideImage(data.imageUrl)
      }
    } catch (error) {
      console.error('Failed to generate guide image:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const pages = [
    { kind: 'intro' as const, title: '概要', body: description },
    ...steps.map((s, i) => ({ kind: 'step' as const, title: `ステップ ${i + 1}`, body: s })),
    { kind: 'done' as const, title: '完了', body: '手順に沿って進めれば完了です。生成後はプレビュー確認→必要に応じて見出し/本文/SEOスコアで調整してください。' },
  ]

  const maxPage = Math.max(0, pages.length - 1)
  const safePage = Math.min(maxPage, Math.max(0, page))

  function close() {
    setIsOpen(false)
  }

  function goPrev() {
    setPage((p) => Math.max(0, p - 1))
  }

  function goNext() {
    setPage((p) => Math.min(maxPage, p + 1))
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        使い方のガイド
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={close}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              {imageMode === 'off' ? (
                <div className="relative flex-shrink-0">
                  <div className="p-5 sm:p-6 bg-gradient-to-br from-[#2563EB] to-indigo-700">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-white/90 text-[10px] sm:text-xs font-black uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" />
                        Feature Guide
                      </div>
                      <button
                        onClick={close}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <h2 className="mt-2 text-xl sm:text-2xl font-black text-white leading-tight">{title}</h2>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-[16/9] sm:aspect-[1200/630] bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-xs sm:text-sm text-gray-400 font-medium">準備中…</p>
                    </div>
                  ) : guideImage ? (
                    <img src={guideImage} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 opacity-20" />
                      <p className="text-xs sm:text-sm font-medium">No image</p>
                    </div>
                  )}
                  
                  <button 
                    onClick={close}
                    className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    <div className="flex items-center gap-2 text-blue-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Feature Guide
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{title}</h2>
                  </div>
                </div>
              )}

              {/* Content - Swipe like carousel */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0">
                {/* slider */}
                <div className="relative">
                  <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar -mx-5 px-5 sm:-mx-6 sm:px-6">
                    <div
                      className="flex gap-4"
                      style={{ transform: `translateX(calc(${-safePage} * (100% + 16px)))`, transition: 'transform 220ms ease-out' }}
                    >
                      {pages.map((p, i) => (
                        <div
                          key={`${p.kind}-${i}`}
                          className="snap-center w-full flex-shrink-0"
                        >
                          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[11px] font-black text-gray-700">
                                  {i + 1}
                                </div>
                                <p className="text-sm sm:text-base font-black text-gray-900 truncate">{p.title}</p>
                              </div>
                              <p className="text-[10px] font-black text-gray-400 tabular-nums">
                                {i + 1}/{pages.length}
                              </p>
                            </div>
                            <p className="mt-3 text-xs sm:text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                              {p.body}
                            </p>
                            {p.kind === 'intro' && (
                              <div className="mt-4 p-3 rounded-xl bg-white border border-gray-100">
                                <div className="flex items-start gap-2 text-[11px] font-bold text-gray-600">
                                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                                  <p>
                                    右にスワイプ（または「次へ」）で手順を確認できます。必要な場合は後からいつでも開けます。
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* dots */}
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {pages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPage(i)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          i === safePage ? 'bg-blue-600 scale-110' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                        aria-label={`guide page ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* controls */}
                <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
                  <div className="flex items-center gap-2 justify-between sm:justify-start">
                    <button
                      type="button"
                      onClick={goPrev}
                      disabled={safePage === 0}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      戻る
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={safePage === maxPage}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-gray-900 text-white font-black text-xs hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      次へ
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button 
                    onClick={close}
                    className="h-11 sm:h-10 px-6 bg-[#2563EB] text-white font-black rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all text-sm"
                  >
                    わかった！
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}


