'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import StepInputMethod from './StepInputMethod'
import StepContentInput from './StepContentInput'
import StepAnalysis from './StepAnalysis'
import StepPlatformSelect from './StepPlatformSelect'
import StepGeneration from './StepGeneration'

// ============================================
// ステップ定義
// ============================================
const STEPS = [
  { number: 1, label: '入力方法選択' },
  { number: 2, label: 'コンテンツ入力' },
  { number: 3, label: 'AI分析' },
  { number: 4, label: 'プラットフォーム選択' },
  { number: 5, label: '生成' },
] as const

// ============================================
// Wizard State
// ============================================
export interface WizardState {
  inputMethod: 'url' | 'text' | 'youtube' | 'video' | null
  projectId: string | null
  selectedPlatforms: string[]
  brandVoiceId: string | null
  customInstructions: string
  analysisData: AnalysisData | null
}

export interface AnalysisData {
  summary: string
  keywords: string[]
  hashtags: string[]
  topicCategory: string
  tone: string
  sentiment: string
}

// ============================================
// CreateWizard コンポーネント
// ============================================
export default function CreateWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [wizardState, setWizardState] = useState<WizardState>({
    inputMethod: null,
    projectId: null,
    selectedPlatforms: [],
    brandVoiceId: null,
    customInstructions: '',
    analysisData: null,
  })

  // ステップ遷移
  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 5))
  }, [])

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }, [])

  // 入力方法選択
  const handleInputMethodSelect = useCallback(
    (method: 'url' | 'text' | 'youtube' | 'video') => {
      setWizardState((prev) => ({ ...prev, inputMethod: method }))
      goNext()
    },
    [goNext]
  )

  // コンテンツ入力完了
  const handleContentSubmit = useCallback(
    (projectId: string) => {
      setWizardState((prev) => ({ ...prev, projectId }))
      goNext()
    },
    [goNext]
  )

  // 分析完了
  const handleAnalysisComplete = useCallback(
    (data: AnalysisData) => {
      setWizardState((prev) => ({ ...prev, analysisData: data }))
      goNext()
    },
    [goNext]
  )

  // プラットフォーム選択完了
  const handlePlatformSelect = useCallback(
    (platforms: string[], brandVoiceId: string | null, instructions: string) => {
      setWizardState((prev) => ({
        ...prev,
        selectedPlatforms: platforms,
        brandVoiceId,
        customInstructions: instructions,
      }))
      goNext()
    },
    [goNext]
  )

  // 生成完了
  const handleGenerationComplete = useCallback(() => {
    if (wizardState.projectId) {
      router.push(`/tenkai/projects/${wizardState.projectId}`)
    }
  }, [router, wizardState.projectId])

  // 次へボタンの有効/無効
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1:
        return wizardState.inputMethod !== null
      case 2:
        return wizardState.projectId !== null
      case 3:
        return wizardState.analysisData !== null
      case 4:
        return wizardState.selectedPlatforms.length > 0
      default:
        return false
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ======== ステップインジケータ ======== */}
      <div className="mb-10">
        <div className="flex items-center justify-between relative">
          {/* 接続線 */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((step) => {
            const isCompleted = currentStep > step.number
            const isCurrent = currentStep === step.number

            return (
              <div key={step.number} className="relative flex flex-col items-center z-10">
                <motion.div
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted || isCurrent ? '#3B82F6' : '#E2E8F0',
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isCompleted || isCurrent ? 'text-white shadow-lg shadow-blue-500/30' : 'text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-lg">check</span>
                  ) : (
                    step.number
                  )}
                </motion.div>
                <span
                  className={`mt-2 text-xs font-medium whitespace-nowrap ${
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ======== ステップコンテンツ ======== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && (
            <StepInputMethod onSelect={handleInputMethodSelect} />
          )}
          {currentStep === 2 && wizardState.inputMethod && (
            <StepContentInput
              inputMethod={wizardState.inputMethod}
              onSubmit={handleContentSubmit}
            />
          )}
          {currentStep === 3 && wizardState.projectId && (
            <StepAnalysis
              projectId={wizardState.projectId}
              onComplete={handleAnalysisComplete}
            />
          )}
          {currentStep === 4 && (
            <StepPlatformSelect
              onSubmit={handlePlatformSelect}
            />
          )}
          {currentStep === 5 && wizardState.projectId && (
            <StepGeneration
              projectId={wizardState.projectId}
              platforms={wizardState.selectedPlatforms}
              brandVoiceId={wizardState.brandVoiceId}
              customInstructions={wizardState.customInstructions}
              onComplete={handleGenerationComplete}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ======== ナビゲーションボタン ======== */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-200">
          <button
            onClick={goBack}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              currentStep === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            戻る
          </button>

          {currentStep !== 1 && (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${
                canGoNext()
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              次へ
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
