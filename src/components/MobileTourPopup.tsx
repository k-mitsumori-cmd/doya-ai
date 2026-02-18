'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { 
  X, ArrowRight, ArrowLeft, Sparkles, Link2, 
  Wand2, Image, Download, MessageSquare, ChevronRight
} from 'lucide-react'

export type MobileTourSlide = {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  color: string // bg-blue-500 など
}

// デフォルトのバナー生成用スライド
export const BANNER_TOUR_SLIDES: MobileTourSlide[] = [
  {
    id: 'welcome',
    icon: <Sparkles className="w-12 h-12" />,
    title: 'ドヤバナーAIへようこそ！',
    description: 'プロ品質のバナーテンプレートから好みのスタイルを選んで、AIがあなただけのバナーを生成します。',
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  },
  {
    id: 'step1',
    icon: <Image className="w-12 h-12" />,
    title: '① スタイルを選ぶ',
    description: 'ギャラリーに並んだバナーテンプレートから、好みのデザインをタップしてください。ジャンルタブで絞り込みもできます。',
    color: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  },
  {
    id: 'step2',
    icon: <Wand2 className="w-12 h-12" />,
    title: '② 「このスタイルで生成」をタップ',
    description: 'プレビューが表示されたら「このスタイルで生成」ボタンを押して、生成フォームへ進みます。',
    color: 'bg-gradient-to-br from-purple-500 to-pink-600',
  },
  {
    id: 'step3',
    icon: <MessageSquare className="w-12 h-12" />,
    title: '③ テキスト・サイズを設定',
    description: '見出しテキストやバナーサイズ、生成枚数を設定します。ロゴや人物画像の追加もできます。',
    color: 'bg-gradient-to-br from-orange-500 to-red-500',
  },
  {
    id: 'step4',
    icon: <Wand2 className="w-12 h-12" />,
    title: '④ AIが生成！',
    description: 'AIが選んだスタイルをベースにバナーを自動生成します。約30秒〜1分ほどお待ちください。',
    color: 'bg-gradient-to-br from-cyan-500 to-blue-600',
  },
  {
    id: 'step5',
    icon: <Download className="w-12 h-12" />,
    title: '⑤ ダウンロード',
    description: '完成したバナーをタップしてダウンロード。SNS広告やWebサイトにすぐ使えます！',
    color: 'bg-gradient-to-br from-pink-500 to-rose-600',
  },
]

interface Props {
  storageKey: string
  autoStart?: boolean
  slides?: MobileTourSlide[]
}

export default function MobileTourPopup({ storageKey, autoStart = true, slides = BANNER_TOUR_SLIDES }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const total = slides.length
  const current = slides[currentIndex]

  const close = useCallback((markSeen: boolean) => {
    setIsOpen(false)
    setCurrentIndex(0)
    if (markSeen) {
      try {
        localStorage.setItem(storageKey, 'true')
      } catch {}
    }
  }, [storageKey])

  const open = useCallback(() => {
    setIsOpen(true)
    setCurrentIndex(0)
  }, [])

  const next = useCallback(() => {
    if (currentIndex >= total - 1) {
      close(true)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }, [currentIndex, total, close])

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }, [currentIndex])

  // 初回表示時に自動起動（スマホのみ）
  useEffect(() => {
    if (!autoStart) return
    // スマホ判定（768px以下）
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (!isMobile) return

    try {
      const seen = localStorage.getItem(storageKey)
      if (seen) return
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => open(), 600)
    return () => window.clearTimeout(t)
  }, [autoStart, storageKey, open])

  // スワイプ操作
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const diff = e.changedTouches[0].clientX - touchStart
    if (diff > 50) {
      prev()
    } else if (diff < -50) {
      next()
    }
    setTouchStart(null)
  }

  // スマホでのみ表示（デスクトップは非表示）
  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] md:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* 背景 */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* コンテンツ */}
          <div className="relative h-full flex flex-col items-center justify-center p-6">
            {/* 閉じるボタン */}
            <button
              type="button"
              onClick={() => close(true)}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <X className="w-6 h-6" />
            </button>

            {/* スキップボタン */}
            <button
              type="button"
              onClick={() => close(true)}
              className="absolute top-4 left-4 px-3 py-1.5 text-white/70 text-xs font-bold hover:text-white transition-colors"
            >
              スキップ
            </button>

            {/* スライドカード */}
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full max-w-sm"
              >
                {/* アイコン */}
                <div className={`mx-auto w-24 h-24 rounded-3xl ${current.color} flex items-center justify-center text-white shadow-2xl`}>
                  {current.icon}
                </div>

                {/* テキスト */}
                <div className="mt-8 text-center">
                  <h2 className="text-2xl font-black text-white leading-tight">
                    {current.title}
                  </h2>
                  <p className="mt-4 text-base text-white/80 font-medium leading-relaxed">
                    {current.description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* プログレスドット */}
            <div className="mt-10 flex items-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                    idx === currentIndex 
                      ? 'bg-white w-6' 
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`スライド${idx + 1}`}
                />
              ))}
            </div>

            {/* ナビゲーションボタン */}
            <div className="mt-8 flex items-center gap-4">
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="px-5 py-3 rounded-2xl bg-white/10 text-white text-sm font-black flex items-center gap-2 hover:bg-white/20 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  戻る
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="px-6 py-3 rounded-2xl bg-white text-slate-900 text-sm font-black flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-xl"
              >
                {currentIndex >= total - 1 ? (
                  <>
                    はじめる
                    <Sparkles className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    次へ
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* スワイプヒント */}
            <p className="mt-6 text-[11px] text-white/40 font-medium">
              ← スワイプで移動 →
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}





