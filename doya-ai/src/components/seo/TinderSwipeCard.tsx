'use client'

import { useMemo, useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from 'framer-motion'
import { Heart, X, FileText, Target, Search, Users, Compass, BarChart3, Lightbulb, CheckCircle, Layout, MessageSquare } from 'lucide-react'

export type SwipeDecision = 'yes' | 'no' | 'hold'

// カテゴリに応じたアイコンとグラデーションを返す
function getCategoryVisual(category: string): { icon: React.ReactNode; gradient: string; label: string } {
  const cat = String(category || '').toLowerCase()
  
  if (cat.includes('記事の種類') || cat.includes('記事タイプ') || cat.includes('タイプ')) {
    return {
      icon: <FileText className="w-12 h-12 text-blue-600" strokeWidth={1.5} />,
      gradient: 'from-blue-200 via-indigo-100 to-sky-200',
      label: '記事タイプ',
    }
  }
  if (cat.includes('方向性') || cat.includes('戦略')) {
    return {
      icon: <Compass className="w-12 h-12 text-emerald-600" strokeWidth={1.5} />,
      gradient: 'from-emerald-200 via-teal-100 to-cyan-200',
      label: '記事の方向性',
    }
  }
  if (cat.includes('キーワード') || cat.includes('検索')) {
    return {
      icon: <Search className="w-12 h-12 text-violet-600" strokeWidth={1.5} />,
      gradient: 'from-violet-200 via-purple-100 to-fuchsia-200',
      label: 'キーワード',
    }
  }
  if (cat.includes('ターゲット') || cat.includes('読者') || cat.includes('ペルソナ')) {
    return {
      icon: <Users className="w-12 h-12 text-orange-600" strokeWidth={1.5} />,
      gradient: 'from-orange-200 via-amber-100 to-yellow-200',
      label: 'ターゲット読者',
    }
  }
  if (cat.includes('長さ') || cat.includes('文字数') || cat.includes('ボリューム')) {
    return {
      icon: <BarChart3 className="w-12 h-12 text-cyan-600" strokeWidth={1.5} />,
      gradient: 'from-cyan-200 via-sky-100 to-blue-200',
      label: '記事の長さ',
    }
  }
  if (cat.includes('確認') || cat.includes('チェック')) {
    return {
      icon: <CheckCircle className="w-12 h-12 text-green-600" strokeWidth={1.5} />,
      gradient: 'from-green-200 via-emerald-100 to-teal-200',
      label: '確認',
    }
  }
  if (cat.includes('コンテンツ') || cat.includes('内容')) {
    return {
      icon: <Lightbulb className="w-12 h-12 text-amber-600" strokeWidth={1.5} />,
      gradient: 'from-amber-200 via-yellow-100 to-orange-200',
      label: 'コンテンツ内容',
    }
  }
  if (cat.includes('構成') || cat.includes('アウトライン')) {
    return {
      icon: <Layout className="w-12 h-12 text-indigo-600" strokeWidth={1.5} />,
      gradient: 'from-indigo-200 via-blue-100 to-violet-200',
      label: '記事構成',
    }
  }
  if (cat.includes('トーン') || cat.includes('雰囲気') || cat.includes('文体')) {
    return {
      icon: <MessageSquare className="w-12 h-12 text-pink-600" strokeWidth={1.5} />,
      gradient: 'from-pink-200 via-rose-100 to-red-200',
      label: 'トーン・文体',
    }
  }
  // デフォルト
  return {
    icon: <Target className="w-12 h-12 text-rose-600" strokeWidth={1.5} />,
    gradient: 'from-rose-200 via-pink-100 to-red-200',
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
    if (isSwiping) return
    
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
  
  // スワイプアニメーションを実行（滑らかに横移動）
  const performSwipeAnimation = async (decision: 'yes' | 'no') => {
    if (isSwiping) return
    
    setIsSwiping(true)
    playSwipeSfx(decision)
    
    const direction = decision === 'yes' ? 1 : -1
    
    // 滑らかなスワイプアニメーション（ゆっくり横に流れる）
    await controls.start({
      x: direction * 800,
      y: 50,
      rotate: direction * 15,
      opacity: 0,
      scale: 0.9,
      transition: { 
        duration: 0.8,
        ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for smooth motion
        x: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
        rotate: { duration: 0.6, ease: 'easeOut' },
        opacity: { duration: 0.5, delay: 0.3 },
      },
    })
    
    // 完了後にコールバック
    onSwipe(decision)
    setIsSwiping(false)
  }
  
  // ボタンクリック時
  const handleButtonClick = async (decision: 'yes' | 'no') => {
    if (isSwiping || index !== 0) return
    
    setIsSwiping(true)
    playSwipeSfx(decision)
    
    const direction = decision === 'yes' ? 1 : -1
    
    // まずオーバーレイを見せるために少し傾ける
    await controls.start({
      x: direction * 100,
      rotate: direction * 5,
      transition: { duration: 0.15, ease: 'easeOut' },
    })
    
    // そして滑らかに飛んでいく
    await controls.start({
      x: direction * 800,
      y: 50,
      rotate: direction * 15,
      opacity: 0,
      scale: 0.9,
      transition: { 
        duration: 0.7,
        ease: [0.4, 0, 0.2, 1],
        opacity: { duration: 0.4, delay: 0.3 },
      },
    })
    
    // 完了後にコールバック
    onSwipe(decision)
    setIsSwiping(false)
  }

  if (index >= 3) return null

  const normalizedQuestion = useMemo(() => {
    return String(question.question || '').replace(/\s*\n+\s*/g, '')
  }, [question.question])

  // カテゴリに応じたビジュアル（常にアイコンを表示）
  const categoryVisual = useMemo(() => getCategoryVisual(question.category), [question.category])

  const stackYOffset = index * 12

  return (
    <motion.div
      className="absolute w-full max-w-3xl mx-auto cursor-grab active:cursor-grabbing"
      style={{
        x: index === 0 ? x : 0,
        y: index === 0 ? y : stackYOffset,
        rotate: index === 0 ? rotate : 0,
        zIndex: total - index,
        scale: 1 - index * 0.03,
        opacity: index === 0 ? 1 : Math.max(0.4, 1 - index * 0.2),
        pointerEvents: index === 0 && !isSwiping ? 'auto' : 'none',
      }}
      animate={isSwiping ? controls : undefined}
      drag={index === 0 && !isSwiping}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
    >
      {/* カード本体 */}
      <div className="relative rounded-3xl bg-gradient-to-br from-white via-gray-50 to-white shadow-2xl border border-gray-100 overflow-hidden">
        
        {/* LIKE/NOPE オーバーレイ */}
        {index === 0 && (
          <>
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 bg-emerald-500/20"
              style={{ opacity: likeOpacity }}
            >
              <div className="w-32 h-32 rounded-full border-4 border-emerald-500 flex items-center justify-center bg-white/80 shadow-2xl">
                <Heart className="w-16 h-16 text-emerald-500 fill-emerald-500" strokeWidth={2} />
              </div>
              <span className="absolute bottom-20 text-4xl font-black text-emerald-600">YES!</span>
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 bg-red-500/20"
              style={{ opacity: nopeOpacity }}
            >
              <div className="w-32 h-32 rounded-full border-4 border-red-500 flex items-center justify-center bg-white/80 shadow-2xl">
                <X className="w-16 h-16 text-red-500" strokeWidth={2} />
              </div>
              <span className="absolute bottom-20 text-4xl font-black text-red-600">NO!</span>
            </motion.div>
          </>
        )}

        <div className="p-6 md:p-8">
          {/* カテゴリタグ */}
          <div className="mb-4">
            <span className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 text-sm font-bold rounded-full">
              {question.category}
            </span>
          </div>

          {/* カテゴリアイコン（常に表示） */}
          <div className={`mb-6 rounded-2xl bg-gradient-to-br ${categoryVisual.gradient} h-32 flex items-center justify-center`}>
            <div className="p-4 rounded-full bg-white/70 shadow-lg">
              {categoryVisual.icon}
            </div>
            <span className="ml-4 text-lg font-bold text-gray-700">{categoryVisual.label}</span>
          </div>

          {/* 質問 */}
          <div className="bg-white rounded-2xl p-6 shadow-inner border border-gray-100 min-h-[120px] flex items-center justify-center">
            <h2 
              className="text-xl md:text-2xl font-bold text-gray-900 text-center leading-relaxed"
              style={{ wordBreak: 'keep-all' }}
            >
              {normalizedQuestion}
            </h2>
          </div>

          {/* YES/NOボタン */}
          {index === 0 && (
            <div className="flex items-center justify-center gap-6 mt-6">
              <button
                onClick={() => handleButtonClick('no')}
                disabled={isSwiping}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
              >
                <X className="w-10 h-10 text-white" strokeWidth={3} />
              </button>
              <button
                onClick={() => handleButtonClick('yes')}
                disabled={isSwiping}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
              >
                <Heart className="w-10 h-10 text-white fill-white" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
