'use client'

import { useState, useEffect } from 'react'
import { 
  X, Sparkles, ArrowRight, ArrowLeft, Check, 
  FileText, MessageSquare, Zap, Copy, HelpCircle
} from 'lucide-react'
import Link from 'next/link'

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'ようこそ！',
    description: 'カンタンドヤAIへようこそ！\n文章作成が驚くほどカンタンになります。',
    icon: Sparkles,
    color: 'bg-blue-500',
    image: null,
  },
  {
    id: 2,
    title: 'テンプレートを選ぶ',
    description: '作りたい文章の種類を選びます。\nビジネスメール、お知らせ文、SNS投稿など\n68種類から選べます。',
    icon: FileText,
    color: 'bg-green-500',
    image: null,
  },
  {
    id: 3,
    title: '情報を入力する',
    description: '簡単な項目に入力するだけ。\n難しい文章を考える必要はありません。\n例文を参考にできます。',
    icon: MessageSquare,
    color: 'bg-purple-500',
    image: null,
  },
  {
    id: 4,
    title: 'ボタンを押す',
    description: '「生成」ボタンを押すだけで\nAIが文章を自動で作成します。\n約10〜20秒で完成！',
    icon: Zap,
    color: 'bg-amber-500',
    image: null,
  },
  {
    id: 5,
    title: 'コピーして完了！',
    description: '完成した文章をコピーして\nメールやチャットに貼り付けるだけ。\n何度でも再生成できます。',
    icon: Copy,
    color: 'bg-rose-500',
    image: null,
  },
]

interface OnboardingModalProps {
  onClose: () => void
}

export default function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true')
    onClose()
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true')
    onClose()
  }

  const step = ONBOARDING_STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">はじめての方へ</span>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-8 text-center">
          {/* アイコン */}
          <div className={`w-20 h-20 ${step.color} rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg`}>
            <step.icon className="w-10 h-10 text-white" />
          </div>

          {/* タイトル */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {step.title}
          </h2>

          {/* 説明 */}
          <p className="text-lg text-gray-600 whitespace-pre-line leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* プログレスドット */}
        <div className="flex justify-center gap-2 pb-4">
          {ONBOARDING_STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-blue-600 w-6'
                  : index < currentStep
                  ? 'bg-blue-300'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-2.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              スキップ
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
            >
              {currentStep === ONBOARDING_STEPS.length - 1 ? (
                <>
                  <Check className="w-4 h-4" />
                  始める
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
      </div>
    </div>
  )
}

