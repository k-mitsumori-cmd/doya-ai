'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Crown, 
  Sparkles, 
  Check, 
  Zap, 
  Palette, 
  MessageSquare, 
  Clock, 
  Star,
  Rocket,
  PartyPopper,
  X
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface UpgradeSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  planName?: 'PRO' | 'ENTERPRISE'
}

const PRO_FEATURES = [
  { icon: Palette, text: '1日30枚まで生成可能', highlight: true },
  { icon: Zap, text: 'サイズ自由指定' },
  { icon: MessageSquare, text: '同時生成: 最大5枚' },
  { icon: Star, text: '高品質な画像生成' },
]

const ENTERPRISE_FEATURES = [
  { icon: Rocket, text: '1日200枚まで生成可能', highlight: true },
  { icon: Palette, text: '大量運用・チーム向け' },
  { icon: Zap, text: '優先サポート' },
  { icon: Star, text: 'さらに上限UP相談可' },
]

export default function UpgradeSuccessModal({ isOpen, onClose, planName = 'PRO' }: UpgradeSuccessModalProps) {
  const [showContent, setShowContent] = useState(false)
  
  const features = planName === 'ENTERPRISE' ? ENTERPRISE_FEATURES : PRO_FEATURES
  const planLabel = planName === 'ENTERPRISE' ? 'エンタープライズ' : 'プロ'
  const planColor = planName === 'ENTERPRISE' ? 'rose' : 'orange'

  useEffect(() => {
    if (isOpen) {
      // 紙吹雪アニメーション
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: planName === 'ENTERPRISE' 
            ? ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2']
            : ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: planName === 'ENTERPRISE' 
            ? ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2']
            : ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
        })
      }, 250)

      // コンテンツを少し遅れて表示
      setTimeout(() => setShowContent(true), 300)

      return () => clearInterval(interval)
    } else {
      setShowContent(false)
    }
  }, [isOpen, planName])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 背景グラデーション */}
          <div className={`absolute inset-0 bg-gradient-to-br ${
            planName === 'ENTERPRISE' 
              ? 'from-rose-500/10 via-pink-500/5 to-transparent' 
              : 'from-orange-500/10 via-amber-500/5 to-transparent'
          }`} />
          
          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors z-10"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          <div className="relative p-8 text-center">
            {/* アイコンとお祝いメッセージ */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2, damping: 15 }}
              className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                planName === 'ENTERPRISE' 
                  ? 'bg-gradient-to-br from-rose-500 to-pink-600' 
                  : 'bg-gradient-to-br from-orange-500 to-amber-600'
              } shadow-lg`}
            >
              <Crown className="w-10 h-10 text-white" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <PartyPopper className={`w-5 h-5 ${planName === 'ENTERPRISE' ? 'text-rose-500' : 'text-orange-500'}`} />
                <span className="text-sm font-bold text-slate-500">UPGRADE COMPLETE</span>
                <PartyPopper className={`w-5 h-5 ${planName === 'ENTERPRISE' ? 'text-rose-500' : 'text-orange-500'} transform scale-x-[-1]`} />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                {planLabel}プランへ<br />アップグレード完了！
              </h2>
              
              <p className="text-slate-600 text-sm mb-6">
                ご登録ありがとうございます！<br />
                さっそく新しい機能をお楽しみください 🎉
              </p>
            </motion.div>

            {/* 新機能リスト */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-50 rounded-2xl p-4 mb-6 text-left"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className={`w-4 h-4 ${planName === 'ENTERPRISE' ? 'text-rose-500' : 'text-orange-500'}`} />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  できることが増えました！
                </span>
              </div>
              
              <ul className="space-y-2">
                {features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className={`flex items-center gap-3 p-2 rounded-xl ${
                      feature.highlight 
                        ? planName === 'ENTERPRISE'
                          ? 'bg-rose-100'
                          : 'bg-orange-100'
                        : 'bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      feature.highlight
                        ? planName === 'ENTERPRISE'
                          ? 'bg-rose-500 text-white'
                          : 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <feature.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm font-medium ${
                      feature.highlight ? 'text-slate-900 font-bold' : 'text-slate-700'
                    }`}>
                      {feature.text}
                    </span>
                    <Check className={`w-4 h-4 ml-auto ${
                      planName === 'ENTERPRISE' ? 'text-rose-500' : 'text-orange-500'
                    }`} />
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* CTAボタン */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={onClose}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                planName === 'ENTERPRISE'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg shadow-rose-500/30'
                  : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/30'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Rocket className="w-5 h-5" />
                さっそくバナーを作成する
              </span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

