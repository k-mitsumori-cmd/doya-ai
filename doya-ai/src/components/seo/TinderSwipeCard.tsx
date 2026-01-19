'use client'

import { useMemo, useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, PanInfo, useAnimation } from 'framer-motion'
import { Heart, X, FileText, Target, Search, Users, FileCheck, Compass, BarChart3, Lightbulb, CheckCircle } from 'lucide-react'

export type SwipeDecision = 'yes' | 'no' | 'hold'

// カテゴリに応じたアイコンとグラデーションを返す
function getCategoryVisual(category: string): { icon: React.ReactNode; gradient: string; bgPattern: string } {
  const cat = String(category || '').toLowerCase()
  
  if (cat.includes('記事の種類') || cat.includes('記事タイプ') || cat.includes('タイプ')) {
    return {
      icon: <FileText className="w-16 h-16 text-blue-600" strokeWidth={1.5} />,
      gradient: 'from-blue-100 via-indigo-50 to-sky-100',
      bgPattern: 'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(99,102,241,0.12), transparent 50%)',
    }
  }
  if (cat.includes('方向性') || cat.includes('戦略')) {
    return {
      icon: <Compass className="w-16 h-16 text-emerald-600" strokeWidth={1.5} />,
      gradient: 'from-emerald-100 via-teal-50 to-cyan-100',
      bgPattern: 'radial-gradient(circle at 25% 25%, rgba(16,185,129,0.15), transparent 50%), radial-gradient(circle at 75% 75%, rgba(20,184,166,0.12), transparent 50%)',
    }
  }
  if (cat.includes('キーワード') || cat.includes('検索')) {
    return {
      icon: <Search className="w-16 h-16 text-violet-600" strokeWidth={1.5} />,
      gradient: 'from-violet-100 via-purple-50 to-fuchsia-100',
      bgPattern: 'radial-gradient(circle at 20% 30%, rgba(139,92,246,0.15), transparent 50%), radial-gradient(circle at 80% 70%, rgba(192,132,252,0.12), transparent 50%)',
    }
  }
  if (cat.includes('ターゲット') || cat.includes('読者') || cat.includes('ペルソナ')) {
    return {
      icon: <Users className="w-16 h-16 text-orange-600" strokeWidth={1.5} />,
      gradient: 'from-orange-100 via-amber-50 to-yellow-100',
      bgPattern: 'radial-gradient(circle at 30% 70%, rgba(249,115,22,0.15), transparent 50%), radial-gradient(circle at 70% 30%, rgba(251,191,36,0.12), transparent 50%)',
    }
  }
  if (cat.includes('長さ') || cat.includes('文字数') || cat.includes('ボリューム')) {
    return {
      icon: <BarChart3 className="w-16 h-16 text-cyan-600" strokeWidth={1.5} />,
      gradient: 'from-cyan-100 via-sky-50 to-blue-100',
      bgPattern: 'radial-gradient(circle at 25% 75%, rgba(6,182,212,0.15), transparent 50%), radial-gradient(circle at 75% 25%, rgba(14,165,233,0.12), transparent 50%)',
    }
  }
  if (cat.includes('確認') || cat.includes('チェック')) {
    return {
      icon: <CheckCircle className="w-16 h-16 text-green-600" strokeWidth={1.5} />,
      gradient: 'from-green-100 via-emerald-50 to-teal-100',
      bgPattern: 'radial-gradient(circle at 50% 30%, rgba(34,197,94,0.15), transparent 50%), radial-gradient(circle at 50% 70%, rgba(16,185,129,0.12), transparent 50%)',
    }
  }
  if (cat.includes('コンテンツ') || cat.includes('内容')) {
    return {
      icon: <Lightbulb className="w-16 h-16 text-amber-600" strokeWidth={1.5} />,
      gradient: 'from-amber-100 via-yellow-50 to-orange-100',
      bgPattern: 'radial-gradient(circle at 40% 40%, rgba(245,158,11,0.15), transparent 50%), radial-gradient(circle at 60% 60%, rgba(251,191,36,0.12), transparent 50%)',
    }
  }
  // デフォルト
  return {
    icon: <Target className="w-16 h-16 text-rose-600" strokeWidth={1.5} />,
    gradient: 'from-rose-100 via-pink-50 to-red-100',
    bgPattern: 'radial-gradient(circle at 30% 30%, rgba(244,63,94,0.15), transparent 50%), radial-gradient(circle at 70% 70%, rgba(251,113,133,0.12), transparent 50%)',
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

  const playSwipeSfx = (decision: 'yes' | 'no') => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const now = ctx.currentTime

      // whoosh (noise)
      const bufferSize = Math.floor(ctx.sampleRate * 0.12)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.setValueAtTime(800, now)
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.4, now + 0.02)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination)
      noise.start(now)
      noise.stop(now + 0.13)

      // sparkle (osc)
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      const base = decision === 'yes' ? 660 : 220
      osc.frequency.setValueAtTime(base, now)
      osc.frequency.exponentialRampToValueAtTime(base * 1.8, now + 0.08)
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.25, now + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc.connect(g).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.13)

      setTimeout(() => ctx.close?.(), 250)
    } catch {
      // ignore
    }
  }

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (isSwiping) return
    
    const threshold = 120
    const velocity = info.velocity.x

    if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > 600) {
      setIsSwiping(true)
      const direction = info.offset.x > 0 || velocity > 0 ? 'yes' : 'no'
      playSwipeSfx(direction)
      
      try {
        // 派手なスワイプアニメーション（くるくる回転しながら飛んでいく）
        await controls.start({
          x: direction === 'yes' ? 1200 : -1200,
          y: -150,
          rotate: direction === 'yes' ? 180 : -180,
          opacity: 0,
          scale: 0.3,
          transition: { 
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94],
            rotate: { duration: 0.6, ease: 'easeOut' },
          },
        })
        
        // アニメーション完了後にコールバックを呼び出す
        setTimeout(() => {
          onSwipe(direction)
          setIsSwiping(false) // リセット
        }, 50)
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
  
  // ボタンクリック時のスワイプアニメーション（超派手版）
  const handleButtonClick = async (decision: 'yes' | 'no') => {
    if (isSwiping || index !== 0) return
    
    setIsSwiping(true)
    const direction = decision === 'yes' ? 1 : -1
    
    // ボタン押下でもオーバーレイが出るようにxを事前に振る
    x.set(direction * 300)
    y.set(0)
    playSwipeSfx(decision)
    
    // 派手なスワイプアニメーション（くるくる回転しながら飛んでいく）
    try {
      await controls.start({
        x: direction * 1200,
        y: -150,
        rotate: direction * 180,
        opacity: 0,
        scale: 0.3,
        transition: { 
          duration: 0.6,
          ease: [0.25, 0.46, 0.45, 0.94],
          rotate: { duration: 0.6, ease: 'easeOut' },
        },
      })
      
      // アニメーション完了後にコールバックを呼び出す
      setTimeout(() => {
        onSwipe(decision)
        setIsSwiping(false) // リセット
      }, 50)
    } catch (error) {
      console.error('Swipe animation error:', error)
      // エラー時もコールバックを呼び出す
      onSwipe(decision)
      setIsSwiping(false)
    }
  }

  if (index >= 3) return null // 3枚目以降は非表示（重なりを減らす）

  const normalizedQuestion = useMemo(() => {
    return String(question.question || '').replace(/\s*\n+\s*/g, '')
  }, [question.question])

  const imageSrc =
    questionImage?.imageBase64
      ? `data:${questionImage.mimeType || 'image/png'};base64,${questionImage.imageBase64}`
      : questionImage?.url

  // カテゴリに応じたビジュアル（画像がない場合のフォールバック）
  const categoryVisual = useMemo(() => getCategoryVisual(question.category), [question.category])

  const stackYOffset = index * 18

  return (
    <motion.div
      className="absolute w-full max-w-4xl mx-auto cursor-grab active:cursor-grabbing will-change-transform"
      style={{
        x: index === 0 ? (isSwiping ? undefined : x) : 0,
        y: index === 0 ? (isSwiping ? undefined : y) : stackYOffset,
        rotate: index === 0 ? (isSwiping ? undefined : rotate) : 0,
        opacity: isSwiping ? undefined : (index === 0 ? opacity : Math.max(0.25, 1 - index * 0.18)),
        zIndex: total - index,
        scale: index === 0 ? scale : 1 - index * 0.04,
        pointerEvents: index === 0 ? 'auto' : 'none',
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
      {/* TCGカード風の多重枠 + ハイライト */}
      <div className="relative rounded-[32px] p-[3px] bg-gradient-to-br from-white/90 via-emerald-200/70 to-sky-200/60 shadow-[0_40px_100px_rgba(0,0,0,0.16)]">
        <div className="relative rounded-[30px] p-[2px] bg-gradient-to-br from-emerald-400/60 via-teal-300/40 to-sky-300/50">
          <div className="relative bg-gradient-to-br from-white via-emerald-50 to-sky-50 rounded-[28px] shadow-2xl p-8 md:p-12 border border-white/70 overflow-hidden h-[650px] flex flex-col">
            {/* shine */}
            <motion.div
              className="absolute -left-24 -top-24 w-64 h-64 rotate-12 bg-white/35 blur-2xl"
              animate={{ x: [0, 460, 0], y: [0, 120, 0], opacity: [0.35, 0.15, 0.35] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.35),transparent_40%),radial-gradient(circle_at_40%_90%,rgba(245,158,11,0.25),transparent_40%)]" />
            <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(90deg,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:18px_18px]" />
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

        {/* カテゴリタグ（左上を少し大きく） */}
        <div className="mb-5">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/85 backdrop-blur-sm text-emerald-900 text-sm md:text-base font-black rounded-full tracking-wide border border-white shadow-sm">
            {question.category}
          </span>
        </div>

        {/* 質問画像 or カテゴリアイコン（常に表示） */}
        {index === 0 && (
          <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border border-white/70 h-44 relative">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={question.category}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
                onLoad={() => {
                  console.log(`[画像読み込み成功] category: ${question.category}`)
                }}
                onError={(e) => {
                  // 画像読み込みエラー時はフォールバックアイコンを表示
                  console.warn(`[画像読み込みエラー] category: ${question.category}`, e)
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  // 親要素にフォールバッククラスを追加
                  const parent = target.parentElement
                  if (parent) {
                    parent.classList.add('show-fallback')
                  }
                }}
              />
            ) : null}
            {/* フォールバック: カテゴリに応じたアイコン表示（画像がない場合 or 読み込みエラー時） */}
            <div 
              className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${categoryVisual.gradient} ${imageSrc ? 'opacity-0 pointer-events-none' : ''}`}
              style={{ 
                background: imageSrc ? undefined : categoryVisual.bgPattern,
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="p-4 rounded-full bg-white/60 backdrop-blur-sm shadow-lg"
              >
                {categoryVisual.icon}
              </motion.div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-3 text-sm font-black text-gray-700/80"
              >
                {question.category}
              </motion.p>
            </div>
          </div>
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
              {normalizedQuestion}
            </h2>
          </div>
        </div>

        {/* YES/NOボタン */}
        {index === 0 && (
          <div className="flex items-center justify-center gap-8 mt-8 mb-4">
            <button
              onClick={() => handleButtonClick('no')}
              disabled={isSwiping}
              className="group relative w-24 h-24 rounded-2xl bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center border border-white/70 hover:from-red-500 hover:to-rose-700 hover:scale-110 transition-all shadow-[0_18px_40px_rgba(244,63,94,0.35)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-12 h-12 text-white" />
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-black text-red-700 whitespace-nowrap">NO</span>
            </button>
            <button
              onClick={() => handleButtonClick('yes')}
              disabled={isSwiping}
              className="group relative w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center border border-white/70 hover:from-emerald-500 hover:to-teal-700 hover:scale-110 transition-all shadow-[0_18px_40px_rgba(16,185,129,0.32)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Heart className="w-12 h-12 text-white fill-white" />
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-black text-emerald-700 whitespace-nowrap">YES</span>
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
