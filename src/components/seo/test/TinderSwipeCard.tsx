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
  questionImage?: {
    imageBase64: string
    mimeType: string
  }
}

export function TinderSwipeCard({ question, onSwipe, index, total, questionImage }: TinderSwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isSwiping, setIsSwiping] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-400, 400], [-35, 35]) // 傾きを強く（-20から-35、20から35に変更）
  const opacity = useTransform(x, [-400, -200, 0, 200, 400], [0, 0.5, 1, 0.5, 0])
  const scale = useTransform(x, [-400, 0, 400], [0.95, 1, 0.95])

  // LIKE/NOPE オーバーレイの透明度
  const likeOpacity = useTransform(x, [0, 400], [0, 1])
  const nopeOpacity = useTransform(x, [-400, 0], [1, 0])
  
  const controls = useAnimation()

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (isSwiping) return
    
    const threshold = 120
    const velocity = info.velocity.x

    if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > 600) {
      setIsSwiping(true)
      const direction = info.offset.x > 0 || velocity > 0 ? 'yes' : 'no'
      
      try {
        // スワイプアニメーション（確実に表示されるように）
        await controls.start({
          x: direction === 'yes' ? 500 : -500,
          rotate: direction === 'yes' ? 35 : -35,
          opacity: 0,
          scale: 0.8,
          transition: { duration: 0.4, ease: 'easeInOut' },
        })
        
        // アニメーション完了後にコールバックを呼び出す
        setTimeout(() => {
          onSwipe(direction)
          setIsSwiping(false) // リセット
        }, 100)
      } catch (error) {
        console.error('Swipe animation error:', error)
        // エラー時もコールバックを呼び出す
        onSwipe(direction)
        setIsSwiping(false)
      }
    } else if (Math.abs(info.offset.y) > threshold || Math.abs(info.velocity.y) > 600) {
      if (info.offset.y > 0) {
        onSwipe('hold')
      }
    } else {
      // リセット
      x.set(0)
      y.set(0)
    }
  }
  
  // ボタンクリック時のスワイプアニメーション
  const handleButtonClick = async (decision: 'yes' | 'no') => {
    if (isSwiping || index !== 0) return
    
    setIsSwiping(true)
    const direction = decision === 'yes' ? 1 : -1
    
    // スワイプアニメーション（確実に表示されるように）
    try {
      await controls.start({
        x: direction * 500,
        rotate: direction * 35,
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.4, ease: 'easeInOut' },
      })
      
      // アニメーション完了後にコールバックを呼び出す
      setTimeout(() => {
        onSwipe(decision)
        setIsSwiping(false) // リセット
      }, 100)
    } catch (error) {
      console.error('Swipe animation error:', error)
      // エラー時もコールバックを呼び出す
      onSwipe(decision)
      setIsSwiping(false)
    }
  }

  if (index >= 4) return null // 4枚目以降は非表示

  return (
    <motion.div
      className="absolute w-full max-w-4xl mx-auto cursor-grab active:cursor-grabbing"
      style={{
        x: isSwiping ? undefined : x,
        y: isSwiping ? undefined : y,
        rotate: isSwiping ? undefined : rotate,
        opacity: isSwiping ? undefined : (index === 0 ? opacity : Math.max(0.4, 1 - index * 0.2)),
        zIndex: total - index,
        scale: index === 0 ? scale : 1 - index * 0.05,
      }}
      animate={isSwiping ? controls : undefined}
      drag={!isSwiping}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0, y: 50 }}
      exit={{ scale: 0.8, opacity: 0, x: index % 2 === 0 ? 300 : -300 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="bg-gradient-to-br from-white via-emerald-50 to-teal-50 rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-emerald-100 relative overflow-hidden h-[650px] flex flex-col">
        {/* LIKE/NOPE オーバーレイ */}
        {index === 0 && (
          <>
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              style={{ opacity: likeOpacity }}
            >
              <div className="w-40 h-40 rounded-full border-6 border-emerald-500 flex items-center justify-center bg-gradient-to-br from-emerald-400/30 to-emerald-600/30 backdrop-blur-sm shadow-2xl">
                <Heart className="w-20 h-20 text-emerald-600 fill-emerald-600" strokeWidth={4} />
                <span className="absolute bottom-0 -mb-12 text-2xl font-black text-emerald-600">YES</span>
              </div>
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              style={{ opacity: nopeOpacity }}
            >
              <div className="w-40 h-40 rounded-full border-6 border-red-500 flex items-center justify-center bg-gradient-to-br from-red-400/30 to-red-600/30 backdrop-blur-sm shadow-2xl">
                <X className="w-20 h-20 text-red-600" strokeWidth={4} />
                <span className="absolute bottom-0 -mb-12 text-2xl font-black text-red-600">NO</span>
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

        {/* 質問画像 */}
        {index === 0 && (
          <>
            {questionImage?.imageBase64 ? (
              <div className="mb-6 rounded-2xl overflow-hidden shadow-lg bg-white">
                <img
                  src={`data:${questionImage.mimeType || 'image/png'};base64,${questionImage.imageBase64}`}
                  alt={question.category}
                  className="w-full h-48 object-cover"
                  loading="eager"
                  decoding="async"
                  onLoad={() => {
                    // 画像読み込み成功をログに記録
                    console.log(`[画像読み込み成功] category: ${question.category}`)
                  }}
                  onError={(e) => {
                    // 画像読み込みエラー時は再取得を試みる
                    console.error(`[画像読み込みエラー] category: ${question.category}`, e)
                    const target = e.target as HTMLImageElement
                    // エラー時は親要素を更新せず、そのまま表示（フォールバック画像は表示しない）
                  }}
                />
              </div>
            ) : (
              <div className="mb-6 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-emerald-100 to-teal-100 h-48 flex items-center justify-center border-2 border-emerald-200">
                <div className="text-emerald-700 text-sm font-bold">画像を読み込み中...</div>
              </div>
            )}
          </>
        )}

        {/* 質問 */}
        <div className="flex-1 flex items-center justify-center px-4 md:px-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 md:p-10 shadow-lg border border-emerald-100 w-full max-w-full">
            <h2 
              className="text-2xl md:text-4xl font-black text-gray-900 leading-tight md:leading-relaxed text-center"
              style={{ 
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                lineHeight: '1.5',
                textShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              {question.question}
            </h2>
          </div>
        </div>

        {/* YES/NOボタン */}
        {index === 0 && (
          <div className="flex items-center justify-center gap-8 mt-8 mb-4">
            <button
              onClick={() => handleButtonClick('no')}
              disabled={isSwiping}
              className="group relative w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center border-4 border-red-500 hover:from-red-500 hover:to-red-700 hover:scale-110 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-12 h-12 text-white" />
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-black text-red-600 whitespace-nowrap">NO</span>
            </button>
            <button
              onClick={() => handleButtonClick('yes')}
              disabled={isSwiping}
              className="group relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center border-4 border-emerald-500 hover:from-emerald-500 hover:to-emerald-700 hover:scale-110 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Heart className="w-12 h-12 text-white fill-white" />
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-black text-emerald-600 whitespace-nowrap">YES</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
