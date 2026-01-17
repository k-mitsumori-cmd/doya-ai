'use client'

import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from 'framer-motion'
import { Heart, X } from 'lucide-react'

export type SwipeDecision = 'yes' | 'no' | 'hold'

interface TinderSwipeCardProps {
  question: {
    id: string
    category: string
    question: string
  }
  onSwipe: (decision: SwipeDecision) => void
  index: number
  total: number
}

export function TinderSwipeCard({ question, onSwipe, index, total }: TinderSwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-400, 400], [-20, 20])
  const opacity = useTransform(x, [-400, -200, 0, 200, 400], [0, 0.5, 1, 0.5, 0])
  const scale = useTransform(x, [-400, 0, 400], [0.95, 1, 0.95])

  // LIKE/NOPE オーバーレイの透明度
  const likeOpacity = useTransform(x, [0, 400], [0, 1])
  const nopeOpacity = useTransform(x, [-400, 0], [1, 0])

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 120
    const velocity = info.velocity.x

    if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > 600) {
      if (info.offset.x > 0 || velocity > 0) {
        onSwipe('yes')
      } else {
        onSwipe('no')
      }
    } else if (Math.abs(info.offset.y) > threshold || Math.abs(info.velocity.y) > 600) {
      if (info.offset.y > 0) {
        onSwipe('hold')
      }
    }

    // リセット
    x.set(0)
    y.set(0)
  }

  if (index >= 4) return null // 4枚目以降は非表示

  return (
    <motion.div
      className="absolute w-full max-w-lg mx-auto cursor-grab active:cursor-grabbing"
      style={{
        x,
        y,
        rotate,
        opacity: index === 0 ? opacity : Math.max(0.3, 1 - index * 0.25),
        zIndex: total - index,
        scale: index === 0 ? scale : 1 - index * 0.08,
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, x: index % 2 === 0 ? 300 : -300 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="bg-white rounded-3xl shadow-2xl p-12 border border-gray-100 relative overflow-hidden h-[650px] flex flex-col">
        {/* LIKE/NOPE オーバーレイ */}
        {index === 0 && (
          <>
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              style={{ opacity: likeOpacity }}
            >
              <div className="w-32 h-32 rounded-full border-4 border-green-500 flex items-center justify-center bg-green-500/20">
                <Heart className="w-16 h-16 text-green-500 fill-green-500" />
              </div>
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              style={{ opacity: nopeOpacity }}
            >
              <div className="w-32 h-32 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20">
                <X className="w-16 h-16 text-red-500" />
              </div>
            </motion.div>
          </>
        )}

        {/* カテゴリタグ */}
        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 text-xs font-black rounded-full uppercase tracking-wider">
            {question.category}
          </span>
        </div>

        {/* 質問 */}
        <div className="flex-1 flex items-center justify-center px-4">
          <h2 className="text-4xl font-black text-gray-900 leading-relaxed text-center whitespace-pre-wrap break-words">
            {question.question}
          </h2>
        </div>

        {/* YES/NOボタン */}
        {index === 0 && (
          <div className="flex items-center justify-center gap-6 mt-8 mb-4">
            <button
              onClick={() => onSwipe('no')}
              className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center border-4 border-red-300 hover:bg-red-100 hover:scale-110 transition-all shadow-lg active:scale-95"
            >
              <X className="w-10 h-10 text-red-600" />
            </button>
            <button
              onClick={() => onSwipe('yes')}
              className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center border-4 border-green-300 hover:bg-green-100 hover:scale-110 transition-all shadow-lg active:scale-95"
            >
              <Heart className="w-10 h-10 text-green-600 fill-green-600" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
