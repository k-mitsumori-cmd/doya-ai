'use client'

import { useMemo, useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, PanInfo, useAnimation, AnimatePresence } from 'framer-motion'
import { Heart, X, FileText, Target, Search, Users, Compass, BarChart3, Lightbulb, CheckCircle, Layout, MessageSquare, Sparkles } from 'lucide-react'

export type SwipeDecision = 'yes' | 'no' | 'hold'

// カテゴリに応じたアイコンとグラデーションを返す
function getCategoryVisual(category: string): { icon: React.ReactNode; gradient: string; iconBg: string; label: string } {
  const cat = String(category || '').toLowerCase()
  
  if (cat.includes('記事の種類') || cat.includes('記事タイプ') || cat.includes('タイプ')) {
    return {
      icon: <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" strokeWidth={1.5} />,
      gradient: 'from-blue-50 via-indigo-50 to-sky-100',
      iconBg: 'from-blue-100 to-indigo-100',
      label: '記事タイプ',
    }
  }
  if (cat.includes('方向性') || cat.includes('戦略')) {
    return {
      icon: <Compass className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" strokeWidth={1.5} />,
      gradient: 'from-emerald-50 via-teal-50 to-cyan-100',
      iconBg: 'from-emerald-100 to-teal-100',
      label: '記事の方向性',
    }
  }
  if (cat.includes('キーワード') || cat.includes('検索')) {
    return {
      icon: <Search className="w-10 h-10 sm:w-12 sm:h-12 text-violet-600" strokeWidth={1.5} />,
      gradient: 'from-violet-50 via-purple-50 to-fuchsia-100',
      iconBg: 'from-violet-100 to-purple-100',
      label: 'キーワード',
    }
  }
  if (cat.includes('ターゲット') || cat.includes('読者') || cat.includes('ペルソナ')) {
    return {
      icon: <Users className="w-10 h-10 sm:w-12 sm:h-12 text-orange-600" strokeWidth={1.5} />,
      gradient: 'from-orange-50 via-amber-50 to-yellow-100',
      iconBg: 'from-orange-100 to-amber-100',
      label: 'ターゲット読者',
    }
  }
  if (cat.includes('長さ') || cat.includes('文字数') || cat.includes('ボリューム')) {
    return {
      icon: <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-600" strokeWidth={1.5} />,
      gradient: 'from-cyan-50 via-sky-50 to-blue-100',
      iconBg: 'from-cyan-100 to-sky-100',
      label: '記事の長さ',
    }
  }
  if (cat.includes('確認') || cat.includes('チェック')) {
    return {
      icon: <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" strokeWidth={1.5} />,
      gradient: 'from-green-50 via-emerald-50 to-teal-100',
      iconBg: 'from-green-100 to-emerald-100',
      label: '確認',
    }
  }
  if (cat.includes('コンテンツ') || cat.includes('内容')) {
    return {
      icon: <Lightbulb className="w-10 h-10 sm:w-12 sm:h-12 text-amber-600" strokeWidth={1.5} />,
      gradient: 'from-amber-50 via-yellow-50 to-orange-100',
      iconBg: 'from-amber-100 to-yellow-100',
      label: 'コンテンツ内容',
    }
  }
  if (cat.includes('構成') || cat.includes('アウトライン')) {
    return {
      icon: <Layout className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-600" strokeWidth={1.5} />,
      gradient: 'from-indigo-50 via-blue-50 to-violet-100',
      iconBg: 'from-indigo-100 to-blue-100',
      label: '記事構成',
    }
  }
  if (cat.includes('トーン') || cat.includes('雰囲気') || cat.includes('文体')) {
    return {
      icon: <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-pink-600" strokeWidth={1.5} />,
      gradient: 'from-pink-50 via-rose-50 to-red-100',
      iconBg: 'from-pink-100 to-rose-100',
      label: 'トーン・文体',
    }
  }
  // デフォルト
  return {
    icon: <Target className="w-10 h-10 sm:w-12 sm:h-12 text-rose-600" strokeWidth={1.5} />,
    gradient: 'from-rose-50 via-pink-50 to-red-100',
    iconBg: 'from-rose-100 to-pink-100',
    label: category || '質問',
  }
}

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
    imageBase64?: string
    mimeType?: string
    url?: string
  }
}

export function TinderSwipeCard({ question, onSwipe, index, total }: TinderSwipeCardProps) {
  const [isSwiping, setIsSwiping] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-25, 25])
  
  // LIKE/NOPE オーバーレイの透明度
  const likeOpacity = useTransform(x, [0, 150], [0, 1])
  const nopeOpacity = useTransform(x, [-150, 0], [1, 0])
  
  const controls = useAnimation()

  const playSwipeSfx = (decision: 'yes' | 'no') => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const now = ctx.currentTime

      // whoosh (noise)
      const bufferSize = Math.floor(ctx.sampleRate * 0.15)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.setValueAtTime(600, now)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.5, now + 0.03)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
      noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination)
      noise.start(now)
      noise.stop(now + 0.16)

      // sparkle (osc)
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      const base = decision === 'yes' ? 880 : 330
      osc.frequency.setValueAtTime(base, now)
      osc.frequency.exponentialRampToValueAtTime(base * 2, now + 0.1)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.3, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
      osc.connect(g).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.16)

      setTimeout(() => ctx.close?.(), 300)
    } catch {
      // ignore
    }
  }

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (isSwiping || isExiting) return
    
    const threshold = 100
    const velocity = info.velocity.x

    if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > 500) {
      const direction = info.offset.x > 0 || velocity > 0 ? 'yes' : 'no'
      await performSwipeAnimation(direction)
    } else {
      // リセット
      x.set(0)
      y.set(0)
    }
  }
  
  // スワイプアニメーションを実行
  const performSwipeAnimation = (decision: 'yes' | 'no') => {
    if (isSwiping || isExiting) return
    
    setIsSwiping(true)
    setIsExiting(true)
    playSwipeSfx(decision)
    
    const direction = decision === 'yes' ? 1 : -1
    
    // アニメーション開始
    controls.start({
      x: direction * 600,
      y: -80,
      rotate: direction * 12,
      opacity: 0,
      scale: 0.9,
      transition: { 
        duration: 0.25,
        ease: 'easeOut',
      },
    })
    
    // 短い遅延後にコールバック（アニメーションを少し見せてから次へ）
    setTimeout(() => {
      onSwipe(decision)
    }, 150)
  }
  
  // ボタンクリック時
  const handleButtonClick = (decision: 'yes' | 'no') => {
    if (isSwiping || isExiting || index !== 0) return
    
    setIsSwiping(true)
    setIsExiting(true)
    playSwipeSfx(decision)
    
    const direction = decision === 'yes' ? 1 : -1
    
    // アニメーション開始
    controls.start({
      x: direction * 600,
      y: -80,
      rotate: direction * 12,
      opacity: 0,
      scale: 0.9,
      transition: { 
        duration: 0.25,
        ease: 'easeOut',
      },
    })
    
    // 短い遅延後にコールバック（アニメーションを少し見せてから次へ）
    setTimeout(() => {
      onSwipe(decision)
    }, 150)
  }

  // 1枚目のみ表示（重なりを完全に排除）
  if (index !== 0) return null

  const normalizedQuestion = useMemo(() => {
    return String(question.question || '').replace(/\s*\n+\s*/g, '')
  }, [question.question])

  // カテゴリに応じたビジュアル
  const categoryVisual = useMemo(() => getCategoryVisual(question.category), [question.category])

  return (
    <motion.div
      className="absolute inset-x-0 top-0 w-full max-w-xl sm:max-w-2xl mx-auto cursor-grab active:cursor-grabbing px-4"
      style={{
        x,
        y,
        rotate,
        zIndex: 10,
      }}
      animate={isSwiping ? controls : { opacity: 1, scale: 1, y: 0 }}
      drag={!isSwiping && !isExiting}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      initial={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* カード本体（リッチなデザイン） */}
      <div className="relative rounded-3xl bg-white overflow-hidden shadow-[0_25px_80px_-12px_rgba(0,0,0,0.25)]">
        {/* 上部のアクセントライン */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        {/* 光沢エフェクト */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-transparent pointer-events-none" />
        
        {/* LIKE/NOPE オーバーレイ */}
        <>
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            style={{ opacity: likeOpacity }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-indigo-500/20" />
            <div className="relative flex flex-col items-center">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-[6px] border-blue-500 flex items-center justify-center bg-white shadow-2xl">
                <Heart className="w-14 h-14 sm:w-16 sm:h-16 text-blue-500 fill-blue-500" strokeWidth={2} />
              </div>
              <span className="mt-4 text-3xl sm:text-4xl font-black text-blue-600 tracking-wider">YES!</span>
            </div>
          </motion.div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            style={{ opacity: nopeOpacity }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-rose-500/20" />
            <div className="relative flex flex-col items-center">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-[6px] border-red-500 flex items-center justify-center bg-white shadow-2xl">
                <X className="w-14 h-14 sm:w-16 sm:h-16 text-red-500" strokeWidth={2.5} />
              </div>
              <span className="mt-4 text-3xl sm:text-4xl font-black text-red-600 tracking-wider">NO!</span>
            </div>
          </motion.div>
        </>

        <div className="relative p-5 sm:p-7 md:p-8">
          {/* カテゴリタグ */}
          <div className="mb-4 sm:mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-900 text-white text-xs sm:text-sm font-semibold rounded-full shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              {question.category}
            </span>
          </div>

          {/* カテゴリアイコンエリア */}
          <div className={`relative mb-5 sm:mb-6 rounded-2xl bg-gradient-to-br ${categoryVisual.gradient} overflow-hidden`}>
            {/* 装飾パターン */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-2 right-2 w-20 h-20 rounded-full bg-white/40 blur-xl" />
              <div className="absolute bottom-2 left-2 w-16 h-16 rounded-full bg-white/30 blur-lg" />
            </div>
            
            <div className="relative flex items-center justify-center py-8 sm:py-10 px-6">
              <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${categoryVisual.iconBg} shadow-lg border border-white/50`}>
                {categoryVisual.icon}
              </div>
              <div className="ml-4 sm:ml-5">
                <p className="text-xs sm:text-sm font-medium text-slate-500 mb-0.5">カテゴリ</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{categoryVisual.label}</p>
              </div>
            </div>
          </div>

          {/* 質問 */}
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 sm:p-7 border border-slate-200/80 min-h-[110px] sm:min-h-[130px] flex items-center justify-center shadow-inner">
            {/* 引用符装飾 */}
            <div className="absolute top-3 left-4 text-4xl sm:text-5xl text-slate-200 font-serif leading-none">"</div>
            <div className="absolute bottom-3 right-4 text-4xl sm:text-5xl text-slate-200 font-serif leading-none rotate-180">"</div>
            
            <h2 
              className="relative text-lg sm:text-xl md:text-2xl font-bold text-slate-800 text-center leading-relaxed px-4"
              style={{ wordBreak: 'keep-all' }}
            >
              {normalizedQuestion}
            </h2>
          </div>

          {/* YES/NOボタン */}
          <div className="flex items-center justify-center gap-5 sm:gap-8 mt-6 sm:mt-8">
            <button
              onClick={() => handleButtonClick('no')}
              disabled={isSwiping || isExiting}
              className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_8px_30px_rgba(239,68,68,0.4)] hover:shadow-[0_12px_40px_rgba(239,68,68,0.5)] hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
              <X className="relative w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={3} />
            </button>
            <button
              onClick={() => handleButtonClick('yes')}
              disabled={isSwiping || isExiting}
              className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_8px_30px_rgba(59,130,246,0.4)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.5)] hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
              <Heart className="relative w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
