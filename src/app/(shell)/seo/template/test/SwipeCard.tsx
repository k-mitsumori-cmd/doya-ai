'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { Check, X, Clock } from 'lucide-react'

export type SwipeDecision = 'yes' | 'no' | 'hold'

interface SwipeCardProps {
  question: {
    id: string
    category: string
    question: string
    description?: string
  }
  onSwipe: (decision: SwipeDecision) => void
  index: number
  total: number
}

export function SwipeCard({ question, onSwipe, index, total }: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-15, 15])
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0, 1, 1, 1, 0])

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100
    const velocity = info.velocity.x

    if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > 500) {
      if (info.offset.x > 0 || velocity > 0) {
        onSwipe('yes')
      } else {
        onSwipe('no')
      }
    } else if (Math.abs(info.offset.y) > threshold || Math.abs(info.velocity.y) > 500) {
      if (info.offset.y > 0) {
        onSwipe('hold')
      }
    }

    // リセット
    x.set(0)
    y.set(0)
  }

  if (index > 2) return null // 3枚目以降は非表示（パフォーマンス）

  return (
    <motion.div
      className="absolute w-full max-w-md mx-auto"
      style={{
        x,
        y,
        rotate,
        opacity: index === 0 ? opacity : 0.7 - index * 0.2,
        zIndex: total - index,
        scale: 1 - index * 0.05,
      }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onDrag={() => setIsDragging(false)}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-gray-100">
        {/* 進捗バー */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2">
            <span>質問 {index + 1} / {total}</span>
            <span className="uppercase tracking-widest">{question.category}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
              initial={{ width: 0 }}
              animate={{ width: `${((index + 1) / total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* 質問 */}
        <h2 className="text-2xl font-black text-gray-900 mb-3 leading-tight">
          {question.question}
        </h2>
        {question.description && (
          <p className="text-sm font-bold text-gray-500 mb-8">
            {question.description}
          </p>
        )}

        {/* 操作ヒント */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <X className="w-7 h-7 text-red-600" />
            </div>
            <span className="text-xs font-black text-gray-600">左にスワイプ<br />除外</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Clock className="w-7 h-7 text-gray-600" />
            </div>
            <span className="text-xs font-black text-gray-600">下にスワイプ<br />保留</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <span className="text-xs font-black text-gray-600">右にスワイプ<br />採用</span>
          </div>
        </div>

        {/* ドラッグ中のオーバーレイ */}
        {isDragging && (
          <motion.div
            className="absolute inset-0 rounded-3xl flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-4xl font-black"
              style={{
                color: x.get() > 0 ? '#10b981' : x.get() < 0 ? '#ef4444' : '#6b7280',
              }}
            >
              {x.get() > 0 ? '採用' : x.get() < 0 ? '除外' : '保留'}
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
