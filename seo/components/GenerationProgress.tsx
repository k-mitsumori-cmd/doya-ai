'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  Clock, 
  Zap, 
  FileText, 
  ImageIcon, 
  CheckCircle2, 
  Loader2,
  BookOpen,
  Target,
  Compass,
  Link2
} from 'lucide-react'

interface GenerationProgressProps {
  progress: number
  step: string
  title: string
}

const steps = [
  { id: 'init', label: '準備中', icon: Zap },
  { id: 'outline', label: '構成案作成', icon: FileText },
  { id: 'sections', label: '本文執筆', icon: Sparkles },
  { id: 'integrate', label: '記事統合', icon: FileText },
  { id: 'media', label: '図解・サムネ生成', icon: ImageIcon },
  { id: 'done', label: '完成', icon: CheckCircle2 },
]

const loadingTips = [
  'AIが記事構成を検討し、読みやすい流れに整えています…',
  '分割生成により、長文でも構造が崩れにくい形で作成しています。',
  '記事内容に合わせて、図解やサムネイルの生成準備を進めています…',
  '検索エンジンだけでなく、AI検索（LLMO）も意識して最適化しています。',
  '文章の一貫性・明確さを保つよう、表現を調整しています…',
  'まもなく完了します。しばらくそのままお待ちください。',
]

const comparisonSteps = [
  { id: 'cmp_ref', label: '参考記事解析', icon: BookOpen },
  { id: 'cmp_candidates', label: '候補収集', icon: Target },
  { id: 'cmp_crawl', label: '公式サイト巡回', icon: Compass },
  { id: 'cmp_extract', label: '情報抽出', icon: Sparkles },
  { id: 'cmp_sources', label: '出典整形', icon: Link2 },
  { id: 'cmp_tables', label: '比較表生成', icon: FileText },
  { id: 'cmp_outline', label: '章立て生成', icon: FileText },
  { id: 'sections', label: '本文ドラフト', icon: Sparkles },
  { id: 'cmp_polish', label: '校正・表現調整', icon: CheckCircle2 },
  { id: 'done', label: '完成', icon: CheckCircle2 },
]

export function GenerationProgress({ progress, step, title }: GenerationProgressProps) {
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % loadingTips.length)
    }, 6000)
    
    const elapsedTimer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => {
      clearInterval(timer)
      clearInterval(elapsedTimer)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isComparison = String(step || '').startsWith('cmp_')
  const stepList = isComparison ? comparisonSteps : steps
  const currentStepIndex = Math.max(0, stepList.findIndex((s) => s.id === step))

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto">
      {/* Animated Icon Header */}
      <div className="relative mb-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-32 h-32 rounded-[40px] border-4 border-blue-500/20 flex items-center justify-center bg-white shadow-2xl shadow-blue-500/10"
        >
          <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-[#2563EB] to-blue-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-12 h-12 text-white animate-pulse" />
          </div>
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -top-4 -right-4 w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 rotate-12"
        >
          <Zap className="w-6 h-6" />
        </motion.div>
      </div>

      {/* Title and Info */}
      <div className="text-center mb-10">
        <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">記事を生成しています</h2>
        <p className="text-blue-600 font-bold text-lg mb-1">{title}</p>
        <div className="flex items-center justify-center gap-4 text-gray-400 text-sm font-bold">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            経過時間: {formatTime(elapsedTime)}
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
          <p>長文につき 3〜10分 ほどかかります</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden mb-4 border border-gray-200 shadow-inner p-1">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-full relative"
        >
          <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        </motion.div>
      </div>
      <div className="flex justify-between w-full text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
        <span>進捗</span>
        <span className="text-blue-600">{progress}%</span>
      </div>

      {/* Step Indicators */}
      <div className={`grid gap-2 w-full mt-12 ${isComparison ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-6'}`}>
        {stepList.map((s, i) => {
          const isActive = i <= currentStepIndex
          const isCurrent = i === currentStepIndex
          const Icon = s.icon
          
          return (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isCurrent 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110' 
                  : isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'bg-gray-50 text-gray-300'
              }`}>
                {isCurrent && !isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span className={`text-[10px] font-bold text-center ${
                isCurrent ? 'text-blue-600' : isActive ? 'text-gray-600' : 'text-gray-300'
              }`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Rotating Tips */}
      <div className="mt-16 w-full">
        <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <AnimatePresence mode="wait">
            <motion.div
              key={tipIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-1">ドヤTip</p>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  {loadingTips[tipIndex]}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
