'use client'

import { useState } from 'react'
import { 
  X, Sparkles, ArrowRight, ArrowLeft, Check, 
  Layers, Target, Zap, Download, HelpCircle, Palette
} from 'lucide-react'

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'ようこそ！',
    description: 'ドヤバナーへようこそ！\nAIがプロ品質のバナーを自動生成します。\nデザイナー不要で広告運用を加速！',
    icon: Sparkles,
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  },
  {
    id: 2,
    title: 'カテゴリを選ぶ',
    description: '通信・EC・マーケティング・採用など、\n目的に合ったカテゴリを選択。\nサイズもワンタップで選べます。',
    icon: Layers,
    color: 'bg-gradient-to-br from-green-500 to-emerald-600',
  },
  {
    id: 3,
    title: 'キーワードを入力',
    description: '「30%OFF」「今だけ」など\n訴求したいキーワードを入力。\n短い言葉でOKです！',
    icon: Target,
    color: 'bg-gradient-to-br from-purple-500 to-violet-600',
  },
  {
    id: 4,
    title: '3案同時生成',
    description: 'ボタンを押すだけで\nA・B・Cの3パターンを自動生成。\n約30秒で完成します！',
    icon: Zap,
    color: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
  {
    id: 5,
    title: 'ダウンロード',
    description: '気に入ったバナーをダウンロード。\n商用利用OK！\n広告・LP・SNSで自由に使えます。',
    icon: Download,
    color: 'bg-gradient-to-br from-rose-500 to-pink-600',
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
    localStorage.setItem('doya_banner_onboarding_completed', 'true')
    onClose()
  }

  const handleSkip = () => {
    localStorage.setItem('doya_banner_onboarding_completed', 'true')
    onClose()
  }

  const step = ONBOARDING_STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
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
          <div className={`w-24 h-24 ${step.color} rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl`}>
            <step.icon className="w-12 h-12 text-white" />
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
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-blue-600 w-8'
                  : index < currentStep
                  ? 'bg-blue-300 w-2'
                  : 'bg-gray-200 w-2'
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
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg"
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

