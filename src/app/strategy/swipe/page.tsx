'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { StrategyAppLayout } from '@/components/StrategyAppLayout'
import { SwipeCard } from '@/components/SwipeCard'
import { STRATEGY_CARDS, StrategyCard } from '@/lib/strategy/cards'
import { Loader2, Sparkles } from 'lucide-react'

interface SwipeResult {
  accepted: string[]
  rejected: string[]
}

export default function SwipeStrategyPage() {
  const router = useRouter()
  const [cards, setCards] = useState<StrategyCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<SwipeResult>({ accepted: [], rejected: [] })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    // カードをシャッフル
    const shuffled = [...STRATEGY_CARDS].sort(() => Math.random() - 0.5)
    setCards(shuffled)
  }, [])

  const handleSwipe = (direction: 'left' | 'right') => {
    if (currentIndex >= cards.length) return

    const currentCard = cards[currentIndex]
    const newResults = { ...results }

    if (direction === 'right') {
      newResults.accepted.push(currentCard.id)
    } else {
      newResults.rejected.push(currentCard.id)
    }

    setResults(newResults)
    setCurrentIndex(currentIndex + 1)

    // すべてのカードをスワイプしたら戦略生成
    if (currentIndex + 1 >= cards.length) {
      handleComplete(newResults)
    }
  }

  const handleComplete = async (finalResults: SwipeResult) => {
    setIsGenerating(true)

    try {
      const response = await fetch('/api/strategy/swipe-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accepted: finalResults.accepted,
          rejected: finalResults.rejected,
          cards: cards,
        }),
      })

      if (!response.ok) {
        throw new Error('戦略生成に失敗しました')
      }

      const data = await response.json()
      
      // 結果ページにリダイレクト
      router.push(`/strategy/swipe/result?projectId=${data.projectId}`)
    } catch (error) {
      console.error('Strategy generation error:', error)
      alert('戦略生成に失敗しました。もう一度お試しください。')
      setIsGenerating(false)
    }
  }

  const remainingCards = cards.length - currentIndex
  const progress = cards.length > 0 ? ((currentIndex / cards.length) * 100) : 0

  if (isGenerating) {
    return (
      <StrategyAppLayout currentPlan="FREE" isLoggedIn={true} firstLoginAt={null}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <Sparkles className="w-full h-full text-indigo-600" />
            </motion.div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">戦略を生成中...</h2>
            <p className="text-gray-600">あなたの選択をもとに最適な戦略を作成しています</p>
          </div>
        </div>
      </StrategyAppLayout>
    )
  }

  if (cards.length === 0) {
    return (
      <StrategyAppLayout currentPlan="FREE" isLoggedIn={true} firstLoginAt={null}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </StrategyAppLayout>
    )
  }

  return (
    <StrategyAppLayout currentPlan="FREE" isLoggedIn={true} firstLoginAt={null}>
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-slate-900 mb-2">スワイプで戦略を決める</h1>
          <p className="text-gray-600">
            カードを右にスワイプ（採用）または左にスワイプ（除外）してください
          </p>
        </div>

        {/* 進捗バー */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>進捗: {currentIndex} / {cards.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* カードスタック */}
        <div className="relative h-[600px] mb-8">
          <AnimatePresence>
            {cards.slice(currentIndex, currentIndex + 3).map((card, index) => (
              <SwipeCard
                key={card.id}
                card={card}
                onSwipe={handleSwipe}
                index={index}
                total={cards.length}
              />
            ))}
          </AnimatePresence>

          {remainingCards === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">完了！</h2>
                <p className="text-gray-600">戦略を生成しています...</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* 操作ガイド */}
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xl">←</span>
              </div>
              <span className="text-sm font-semibold text-gray-700">除外</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xl">→</span>
              </div>
              <span className="text-sm font-semibold text-gray-700">採用</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            スマホではスワイプ、PCではボタンまたはドラッグで操作できます
          </p>
        </div>
      </div>
    </StrategyAppLayout>
  )
}
