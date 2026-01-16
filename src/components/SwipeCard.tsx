'use client'

import React from 'react'
import { motion, PanInfo } from 'framer-motion'
import { StrategyCard } from '@/lib/strategy/cards'
import { X, Check } from 'lucide-react'

interface SwipeCardProps {
  card: StrategyCard
  onSwipe: (direction: 'left' | 'right') => void
  index: number
  total: number
}

export function SwipeCard({ card, onSwipe, index, total }: SwipeCardProps) {
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100
    if (info.offset.x > threshold) {
      onSwipe('right')
    } else if (info.offset.x < -threshold) {
      onSwipe('left')
    }
  }

  const isTopCard = index === 0

  return (
    <motion.div
      drag={isTopCard ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{
        scale: isTopCard ? 1 : 0.95 - index * 0.05,
        opacity: isTopCard ? 1 : 0.7 - index * 0.1,
        y: isTopCard ? 0 : index * 10,
        rotate: isTopCard ? 0 : index * 2,
      }}
      whileDrag={{ scale: 1.05, rotate: 0 }}
      exit={{ x: 300, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`absolute w-full max-w-md mx-auto ${
        isTopCard ? 'z-10 cursor-grab active:cursor-grabbing' : 'z-0'
      }`}
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* カード本体 */}
        <div className="p-8 min-h-[400px] flex flex-col">
          {/* 進捗インジケーター */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>カード {total - index} / {total}</span>
              <span className="px-2 py-1 bg-gray-100 rounded-full text-gray-600 font-semibold">
                {card.category}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <motion.div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-1.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((total - index) / total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* メイン文言 */}
          <div className="flex-1 flex items-center justify-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 text-center leading-tight">
              {card.text}
            </h2>
          </div>

          {/* 補足説明 */}
          {card.description && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">{card.description}</p>
            </div>
          )}

          {/* メタ情報 */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex flex-wrap gap-2 justify-center">
              {card.impact.map((impact) => (
                <span
                  key={impact}
                  className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md"
                >
                  {impact}
                </span>
              ))}
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-md ${
                  card.cost_level === 'low'
                    ? 'bg-green-50 text-green-700'
                    : card.cost_level === 'mid'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                コスト: {card.cost_level === 'low' ? '低' : card.cost_level === 'mid' ? '中' : '高'}
              </span>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-md ${
                  card.difficulty === 'easy'
                    ? 'bg-blue-50 text-blue-700'
                    : card.difficulty === 'normal'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-orange-50 text-orange-700'
                }`}
              >
                難易度: {card.difficulty === 'easy' ? '易' : card.difficulty === 'normal' ? '中' : '難'}
              </span>
            </div>
            {card.recommended_when && (
              <p className="mt-3 text-xs text-gray-500 text-center">{card.recommended_when}</p>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="px-8 pb-8 flex gap-4">
          <button
            onClick={() => onSwipe('left')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors border-2 border-red-200"
          >
            <X className="w-5 h-5" />
            除外
          </button>
          <button
            onClick={() => onSwipe('right')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-green-50 text-green-600 rounded-xl font-semibold hover:bg-green-100 transition-colors border-2 border-green-200"
          >
            <Check className="w-5 h-5" />
            採用
          </button>
        </div>
      </div>

      {/* スワイプ方向インジケーター */}
      {isTopCard && (
        <>
          <motion.div
            className="absolute top-1/2 -left-20 text-red-500 text-6xl font-black opacity-0 pointer-events-none"
            animate={{
              opacity: 0,
            }}
            whileDrag={(_, info) => ({
              opacity: info.offset.x < -50 ? Math.min(Math.abs(info.offset.x) / 200, 0.8) : 0,
            })}
          >
            ✕
          </motion.div>
          <motion.div
            className="absolute top-1/2 -right-20 text-green-500 text-6xl font-black opacity-0 pointer-events-none"
            animate={{
              opacity: 0,
            }}
            whileDrag={(_, info) => ({
              opacity: info.offset.x > 50 ? Math.min(info.offset.x / 200, 0.8) : 0,
            })}
          >
            ✓
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
