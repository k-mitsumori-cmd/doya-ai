'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Newspaper, 
  X, 
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const newsItems = [
  { id: '1', title: 'OpenAI GPT-5発表 - 2025年リリース予定', category: 'AI', isNew: true },
  { id: '2', title: 'Google Imagen 3 - 高品質AI画像生成', category: 'AI', isNew: true },
  { id: '3', title: '日本企業のAI導入率が50%突破', category: 'ビジネス' },
  { id: '4', title: 'Claude 3.5、ベンチマーク最高スコア', category: 'AI' },
  { id: '5', title: 'AIマーケ市場、100億ドル規模へ', category: 'マーケ' },
]

export function AINewsFeed() {
  const [isVisible, setIsVisible] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!isVisible) return null

  const currentNews = newsItems[currentIndex]

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 px-3 py-1.5">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Newspaper className="w-3.5 h-3.5 text-primary-400" />
          <span className="text-[10px] font-bold text-primary-400 uppercase hidden sm:inline">NEWS</span>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-medium">
                {currentNews.category}
              </span>
              <span className="text-xs text-gray-300 truncate">
                {currentNews.title}
              </span>
              {currentNews.isNew && (
                <span className="text-[9px] px-1 py-0.5 bg-red-500 text-white rounded font-bold">
                  NEW
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + newsItems.length) % newsItems.length)}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <span className="text-[10px] text-gray-600 w-8 text-center">{currentIndex + 1}/{newsItems.length}</span>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % newsItems.length)}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
