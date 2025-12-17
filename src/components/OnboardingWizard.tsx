'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  FileText,
  Zap,
  Star,
  ArrowRight,
  Check,
  X,
  Rocket,
  Target,
  Lightbulb,
} from 'lucide-react'
import Link from 'next/link'

interface OnboardingStep {
  title: string
  description: string
  icon: any
  color: string
  action?: {
    label: string
    href: string
  }
}

const steps: OnboardingStep[] = [
  {
    title: 'DOYA-AIへようこそ！',
    description: '68種類のAIテンプレートで、ビジネス文書作成を劇的に効率化。まずは使い方をご案内します！',
    icon: Sparkles,
    color: 'from-primary-500 to-accent-500',
  },
  {
    title: 'テンプレートを選ぶ',
    description: 'マーケティング、SNS、ビジネス文書など15カテゴリから目的に合ったテンプレートを選びましょう。',
    icon: FileText,
    color: 'from-blue-500 to-cyan-500',
    action: {
      label: 'テンプレート一覧を見る',
      href: '/dashboard/text',
    },
  },
  {
    title: '必要事項を入力',
    description: '商品名やターゲット層など、簡単な情報を入力するだけ。複雑なプロンプトは不要です！',
    icon: Target,
    color: 'from-green-500 to-emerald-500',
  },
  {
    title: 'AIが即座に生成',
    description: '数秒でプロ品質のテキストを生成。気に入らなければワンクリックで再生成できます。',
    icon: Zap,
    color: 'from-amber-500 to-orange-500',
  },
  {
    title: '準備完了！',
    description: 'さっそく最初のテンプレートを試してみましょう。おすすめは「ビジネスメール作成」です！',
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
    action: {
      label: 'ビジネスメールを作成する',
      href: '/dashboard/text/business-email',
    },
  },
]

const STORAGE_KEY = 'doya_onboarding_completed'

export function OnboardingWizard() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    // ローカルストレージをチェック
    const completed = localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      // 少し遅延させてから表示（ページ読み込み後）
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handleSkip = () => {
    handleClose()
  }

  const step = steps[currentStep]
  const Icon = step.icon

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* 閉じるボタン */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* プログレスバー */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* コンテンツ */}
          <div className="p-8 pt-12">
            {/* アイコン */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                <Icon className="w-10 h-10 text-white" />
              </div>

              {/* ステップ番号 */}
              <p className="text-sm text-gray-400 mb-2">
                ステップ {currentStep + 1} / {steps.length}
              </p>

              {/* タイトル */}
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {step.title}
              </h2>

              {/* 説明 */}
              <p className="text-gray-600 leading-relaxed mb-8">
                {step.description}
              </p>

              {/* アクションボタン（あれば） */}
              {step.action && (
                <Link
                  href={step.action.href}
                  onClick={handleClose}
                  className="inline-flex items-center gap-2 px-6 py-3 mb-4 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary-500/30"
                >
                  {step.action.label}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </motion.div>
          </div>

          {/* フッター */}
          <div className="px-8 pb-8 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              スキップ
            </button>

            <div className="flex items-center gap-3">
              {/* ステップインジケーター */}
              <div className="flex gap-1.5">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep
                        ? 'bg-primary-500'
                        : index < currentStep
                        ? 'bg-primary-300'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    始める
                    <Rocket className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    次へ
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// オンボーディングを再表示するためのボタン（設定画面用）
export function ResetOnboardingButton() {
  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  return (
    <button
      onClick={handleReset}
      className="text-sm text-primary-600 hover:underline"
    >
      チュートリアルを再表示
    </button>
  )
}


