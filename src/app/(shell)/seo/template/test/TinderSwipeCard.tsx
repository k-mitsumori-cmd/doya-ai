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
      className="absolute w-full max-w-sm mx-auto cursor-grab active:cursor-grabbing"
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
      <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 relative overflow-hidden h-[500px] flex flex-col">
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
        <div className="flex-1 flex items-center justify-center">
          <h2 className="text-3xl font-black text-gray-900 leading-tight text-center">
            {question.question}
          </h2>
        </div>

        {/* 操作ヒント（初回のみ） */}
        {index === 0 && !isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-8 mt-8"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border-2 border-red-200">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <span className="text-xs font-black text-gray-600">左にスワイプ</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center border-2 border-green-200">
                <Heart className="w-8 h-8 text-green-500 fill-green-500" />
              </div>
              <span className="text-xs font-black text-gray-600">右にスワイプ</span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
