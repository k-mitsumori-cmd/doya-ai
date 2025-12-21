'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  HelpCircle, 
  X, 
  Sparkles, 
  ChevronRight,
  Info,
  Loader2
} from 'lucide-react'

interface FeatureGuideProps {
  featureId: string
  title: string
  description: string
  steps: string[]
}

export function FeatureGuide({ featureId, title, description, steps }: FeatureGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [guideImage, setGuideImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // 初めて開くときに画像を生成
    if (isOpen && !guideImage && !isLoading) {
      generateImage()
    }
  }, [isOpen])

  const generateImage = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/guide/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          featureName: title,
          description: `A professional guide banner for "${title}" feature. ${description}`
        })
      })
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
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Image Header */}
              <div className="relative aspect-[16/9] sm:aspect-[1200/630] bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-xs sm:text-sm text-gray-400 font-medium">AI生成中...</p>
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
                  onClick={() => setIsOpen(false)}
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

              {/* Content - Scrollable */}
              <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                  {description}
                </p>

                <div className="space-y-4">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    ステップ
                  </h3>
                  
                  <div className="grid gap-3">
                    {steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-500 flex-shrink-0 shadow-sm">
                          {i + 1}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-700 font-medium leading-normal sm:leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-full sm:w-auto px-8 py-3 bg-[#2563EB] text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:translate-y-[-2px] text-sm sm:text-base"
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


