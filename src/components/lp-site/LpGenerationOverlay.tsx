'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Globe, Layout, Image as ImageIcon, Package, CheckCircle2, Loader2, Zap, Clock, Search, FileText, ExternalLink, Brain, Target, AlertCircle, Lightbulb, CheckCircle, Monitor, Smartphone, Code, Palette } from 'lucide-react'
import confetti from 'canvas-confetti'

type OverlayMood = 'idle' | 'search' | 'think' | 'happy'

interface LpGenerationOverlayProps {
  open: boolean
  progress: number // 0-100
  stageText: string
  mood: OverlayMood
  steps: { label: string; threshold: number; icon: React.ElementType }[]
  allowBackgroundView?: boolean // 背景の結果を表示可能にする
  productInfo?: any // 商品情報（商品理解完了後に表示）
  sections?: any[] // セクション情報（構成生成完了後に表示）
  currentStep?: 'product' | 'structure' | 'wireframe' | 'image' | 'complete' // 現在のステップ
}

const loadingTips = [
  '商品情報を分析し、最適なLP構成を検討しています…',
  'ターゲットに響くコピーとレイアウトを設計しています。',
  'PC/SP別のワイヤーフレームを生成中…',
  '各セクションの画像を高品質で生成しています。',
  'すべてのアセットを整理し、ダウンロード準備を進めています…',
  'まもなく完了します。しばらくそのままお待ちください。',
]

// 商品理解のリアルタイム分析表示コンポーネント
function ProductUnderstandingDisplay({ productInfo, isAnalyzing }: { productInfo?: any; isAnalyzing: boolean }) {
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([])
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [currentAnalysisText, setCurrentAnalysisText] = useState('')
  const [displayedInfo, setDisplayedInfo] = useState<Record<string, string>>({})

  // 分析ステップの定義（メモ化）
  const analysisStepDefinitions = useMemo(() => [
    { key: 'url_parsing', label: 'URLから基本情報を抽出中...', icon: ExternalLink },
    { key: 'meta_analysis', label: 'メタタグとOGタグを解析中...', icon: FileText },
    { key: 'content_extraction', label: 'ページコンテンツを抽出中...', icon: Search },
    { key: 'product_name', label: '商品名を特定中...', icon: Package },
    { key: 'target_analysis', label: 'ターゲット層を分析中...', icon: Target },
    { key: 'problem_identification', label: '解決する課題を特定中...', icon: AlertCircle },
    { key: 'value_proposition', label: '提供価値を分析中...', icon: Lightbulb },
    { key: 'summary', label: '分析結果をまとめ中...', icon: Brain },
  ], [])

  // 分析ステップを順番に表示
  useEffect(() => {
    if (!isAnalyzing && productInfo) {
      // 分析完了時はすべてのステップを完了として表示
      const allSteps = analysisStepDefinitions.map(s => s.key)
      setAnalysisSteps(allSteps)
      setCompletedSteps(new Set(allSteps))
      // 商品情報を表示
      setDisplayedInfo({
        product_name: productInfo.product_name || '',
        target: productInfo.target || '',
        problem: productInfo.problem || '',
        solution: productInfo.solution || '',
      })
      return
    }

    if (isAnalyzing) {
      // 分析中の場合は、ステップを順番に表示
      let stepIndex = 0
      const interval = setInterval(() => {
        if (stepIndex < analysisStepDefinitions.length) {
          const step = analysisStepDefinitions[stepIndex]
          setAnalysisSteps(prev => [...prev, step.key])
          setCurrentAnalysisText(step.label)
          
          // 少し遅れて完了マークを表示
          setTimeout(() => {
            setCompletedSteps(prev => new Set([...prev, step.key]))
            // 商品情報が取得できた場合は表示（リアルタイム更新）
            if (productInfo) {
              if (step.key === 'product_name' && productInfo.product_name) {
                setDisplayedInfo(prev => ({ ...prev, product_name: productInfo.product_name }))
              }
              if (step.key === 'target_analysis' && productInfo.target) {
                setDisplayedInfo(prev => ({ ...prev, target: productInfo.target }))
              }
              if (step.key === 'problem_identification' && productInfo.problem) {
                setDisplayedInfo(prev => ({ ...prev, problem: productInfo.problem }))
              }
              if (step.key === 'value_proposition' && productInfo.solution) {
                setDisplayedInfo(prev => ({ ...prev, solution: productInfo.solution }))
              }
            }
          }, 800)
          
          stepIndex++
        } else {
          clearInterval(interval)
        }
      }, 1500) // 1.5秒ごとに次のステップを表示

      return () => clearInterval(interval)
    }
  }, [isAnalyzing, productInfo, analysisStepDefinitions])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-4 sm:mb-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl border-2 border-teal-200/50 p-4 sm:p-6 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #14b8a6 0, #14b8a6 1px, transparent 1px, transparent 10px)',
        }} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <motion.div
            animate={{ rotate: isAnalyzing ? 360 : 0 }}
            transition={{ duration: 2, repeat: isAnalyzing ? Infinity : 0, ease: 'linear' }}
          >
            <Search className="w-5 h-5 text-teal-600" />
          </motion.div>
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            {isAnalyzing ? '商品を理解中...' : '商品理解が完了しました'}
          </h3>
        </div>

        {/* リアルタイム分析ステップ */}
        <div className="mb-4 space-y-2">
          {analysisStepDefinitions.map((step, index) => {
            const isActive = analysisSteps.includes(step.key)
            const isCompleted = completedSteps.has(step.key)
            const Icon = step.icon
            
            if (!isActive && !isCompleted) return null

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-white/80 border-teal-200'
                    : isActive
                      ? 'bg-teal-100/50 border-teal-300'
                      : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? 'bg-teal-500 text-white'
                    : isActive
                      ? 'bg-teal-200 text-teal-700'
                      : 'bg-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    {step.label}
                  </div>
                  {isActive && !isCompleted && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-xs text-teal-600 mt-1"
                    >
                      分析中...
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* 取得できた商品情報をリアルタイム表示 */}
        {(displayedInfo.product_name || displayedInfo.target || displayedInfo.problem || displayedInfo.solution) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 sm:space-y-3 mt-4"
          >
            {displayedInfo.product_name && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-teal-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-teal-600" />
                  <div className="text-xs font-bold text-teal-700">商品名</div>
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900">{displayedInfo.product_name}</div>
              </motion.div>
            )}
            {displayedInfo.target && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-teal-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-teal-600" />
                  <div className="text-xs font-bold text-teal-700">ターゲット</div>
                </div>
                <div className="text-xs sm:text-sm text-slate-700">{displayedInfo.target}</div>
              </motion.div>
            )}
            {displayedInfo.problem && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-teal-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-teal-600" />
                  <div className="text-xs font-bold text-teal-700">解決する課題</div>
                </div>
                <div className="text-xs sm:text-sm text-slate-700">{displayedInfo.problem}</div>
              </motion.div>
            )}
            {displayedInfo.solution && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-teal-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-4 h-4 text-teal-600" />
                  <div className="text-xs font-bold text-teal-700">提供価値</div>
                </div>
                <div className="text-xs sm:text-sm text-slate-700">{displayedInfo.solution}</div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 分析完了メッセージ */}
        {!isAnalyzing && productInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 sm:mt-4 p-3 bg-teal-100 rounded-xl border border-teal-300"
          >
            <div className="text-xs font-bold text-teal-900 mb-1">✨ 商品理解が完了しました</div>
            <div className="text-xs text-teal-700">この商品情報を基に、最適なLP構成を作成します</div>
          </motion.div>
        )}

        {/* 分析中のメッセージ */}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 sm:mt-4 p-3 bg-teal-100 rounded-xl border border-teal-300"
          >
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-4 h-4 text-teal-600" />
              </motion.div>
              <div className="text-xs font-bold text-teal-900">
                {currentAnalysisText || '商品情報を分析中...'}
              </div>
            </div>
            <div className="text-xs text-teal-700 mt-1">
              サイトの情報を読み取り、商品の特徴を理解しています
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// LP構成生成のリアルタイム表示コンポーネント
function StructureGenerationDisplay({ sections, isGenerating }: { sections?: any[]; isGenerating: boolean }) {
  const [generationSteps, setGenerationSteps] = useState<string[]>([])
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [currentStepText, setCurrentStepText] = useState('')
  const [displayedSections, setDisplayedSections] = useState<any[]>([])

  // 生成ステップの定義
  const structureStepDefinitions = useMemo(() => [
    { key: 'analyze_product', label: '商品情報を分析中...', icon: Brain },
    { key: 'determine_structure', label: '最適なLP構成を決定中...', icon: Layout },
    { key: 'create_hero', label: 'ヒーローセクションを作成中...', icon: Sparkles },
    { key: 'create_problem', label: '課題提示セクションを作成中...', icon: AlertCircle },
    { key: 'create_solution', label: '解決策セクションを作成中...', icon: Lightbulb },
    { key: 'create_features', label: '機能紹介セクションを作成中...', icon: Package },
    { key: 'create_cta', label: 'CTAセクションを作成中...', icon: Target },
    { key: 'finalize', label: '構成を最終調整中...', icon: CheckCircle },
  ], [])

  // 生成ステップを順番に表示
  useEffect(() => {
    if (!isGenerating && sections && sections.length > 0) {
      // 生成完了時はすべてのステップを完了として表示
      const allSteps = structureStepDefinitions.map(s => s.key)
      setGenerationSteps(allSteps)
      setCompletedSteps(new Set(allSteps))
      setDisplayedSections(sections)
      return
    }

    if (isGenerating) {
      // 生成中の場合は、ステップを順番に表示
      let stepIndex = 0
      const interval = setInterval(() => {
        if (stepIndex < structureStepDefinitions.length) {
          const step = structureStepDefinitions[stepIndex]
          setGenerationSteps(prev => [...prev, step.key])
          setCurrentStepText(step.label)
          
          // 少し遅れて完了マークを表示
          setTimeout(() => {
            setCompletedSteps(prev => new Set([...prev, step.key]))
            // セクションが取得できた場合は表示
            if (sections && sections.length > 0) {
              // セクションを段階的に表示
              const sectionsToShow = sections.slice(0, Math.min(stepIndex + 1, sections.length))
              setDisplayedSections(sectionsToShow)
            }
          }, 800)
          
          stepIndex++
        } else {
          clearInterval(interval)
        }
      }, 1500) // 1.5秒ごとに次のステップを表示

      return () => clearInterval(interval)
    }
  }, [isGenerating, sections, structureStepDefinitions])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-4 sm:mb-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200/50 p-4 sm:p-6 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #a855f7 0, #a855f7 1px, transparent 1px, transparent 10px)',
        }} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <motion.div
            animate={{ rotate: isGenerating ? 360 : 0 }}
            transition={{ duration: 2, repeat: isGenerating ? Infinity : 0, ease: 'linear' }}
          >
            <Layout className="w-5 h-5 text-purple-600" />
          </motion.div>
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            {isGenerating ? 'LP構成案を生成中...' : 'LP構成案が完了しました'}
          </h3>
        </div>

        {/* リアルタイム生成ステップ */}
        <div className="mb-4 space-y-2">
          {structureStepDefinitions.map((step, index) => {
            const isActive = generationSteps.includes(step.key)
            const isCompleted = completedSteps.has(step.key)
            const Icon = step.icon
            
            if (!isActive && !isCompleted) return null

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-white/80 border-purple-200'
                    : isActive
                      ? 'bg-purple-100/50 border-purple-300'
                      : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? 'bg-purple-500 text-white'
                    : isActive
                      ? 'bg-purple-200 text-purple-700'
                      : 'bg-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    {step.label}
                  </div>
                  {isActive && !isCompleted && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-xs text-purple-600 mt-1"
                    >
                      生成中...
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* 生成されたセクションをリアルタイム表示 */}
        {displayedSections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 sm:space-y-3 mt-4"
          >
            <div className="mb-2 p-2 bg-purple-100 rounded-lg border border-purple-300">
              <div className="text-xs font-bold text-purple-900 mb-1">📋 生成されたセクション ({displayedSections.length}件)</div>
            </div>
            <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2">
              {displayedSections.map((section, index) => (
                <motion.div
                  key={section.section_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-purple-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-black text-xs sm:text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-xs sm:text-sm font-black text-slate-900">{section.headline || `セクション ${index + 1}`}</div>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] sm:text-xs font-bold rounded whitespace-nowrap">{section.section_type}</span>
                      </div>
                      {section.sub_headline && (
                        <div className="text-xs text-slate-600 mb-1.5" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{section.sub_headline}</div>
                      )}
                      {section.purpose && (
                        <div className="text-[11px] sm:text-xs text-slate-500 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{section.purpose}</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 生成中のメッセージ */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 sm:mt-4 p-3 bg-purple-100 rounded-xl border border-purple-300"
          >
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-4 h-4 text-purple-600" />
              </motion.div>
              <div className="text-xs font-bold text-purple-900">
                {currentStepText || 'LP構成案を生成中...'}
              </div>
            </div>
            <div className="text-xs text-purple-700 mt-1">
              最適なセクション構成を検討し、各セクションの内容を設計しています
            </div>
          </motion.div>
        )}

        {/* 生成完了メッセージ */}
        {!isGenerating && sections && sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 sm:mt-4 p-3 bg-purple-100 rounded-xl border border-purple-300"
          >
            <div className="text-xs font-bold text-purple-900 mb-1">✨ LP構成案が完了しました</div>
            <div className="text-xs text-purple-700">この構成案を基に、ワイヤーフレームと画像を生成します</div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// ワイヤーフレーム生成のリアルタイム表示コンポーネント
function WireframeGenerationDisplay({ isGenerating }: { isGenerating: boolean }) {
  const [generationSteps, setGenerationSteps] = useState<string[]>([])
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [currentStepText, setCurrentStepText] = useState('')

  // 生成ステップの定義
  const wireframeStepDefinitions = useMemo(() => [
    { key: 'analyze_structure', label: 'LP構成を分析中...', icon: Layout },
    { key: 'design_pc_layout', label: 'PC版レイアウトを設計中...', icon: Monitor },
    { key: 'design_sp_layout', label: 'SP版レイアウトを設計中...', icon: Smartphone },
    { key: 'create_pc_wireframe', label: 'PC版ワイヤーフレームを作成中...', icon: Code },
    { key: 'create_sp_wireframe', label: 'SP版ワイヤーフレームを作成中...', icon: Code },
    { key: 'optimize_layout', label: 'レイアウトを最適化中...', icon: Palette },
    { key: 'finalize', label: 'ワイヤーフレームを最終調整中...', icon: CheckCircle },
  ], [])

  // 生成ステップを順番に表示
  useEffect(() => {
    if (!isGenerating) {
      // 生成完了時はすべてのステップを完了として表示
      const allSteps = wireframeStepDefinitions.map(s => s.key)
      setGenerationSteps(allSteps)
      setCompletedSteps(new Set(allSteps))
      return
    }

    if (isGenerating) {
      // 生成中の場合は、ステップを順番に表示
      let stepIndex = 0
      const interval = setInterval(() => {
        if (stepIndex < wireframeStepDefinitions.length) {
          const step = wireframeStepDefinitions[stepIndex]
          setGenerationSteps(prev => [...prev, step.key])
          setCurrentStepText(step.label)
          
          // 少し遅れて完了マークを表示
          setTimeout(() => {
            setCompletedSteps(prev => new Set([...prev, step.key]))
          }, 800)
          
          stepIndex++
        } else {
          clearInterval(interval)
        }
      }, 1200) // 1.2秒ごとに次のステップを表示

      return () => clearInterval(interval)
    }
  }, [isGenerating, wireframeStepDefinitions])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-4 sm:mb-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200/50 p-4 sm:p-6 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #6366f1 0, #6366f1 1px, transparent 1px, transparent 10px)',
        }} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <motion.div
            animate={{ rotate: isGenerating ? 360 : 0 }}
            transition={{ duration: 2, repeat: isGenerating ? Infinity : 0, ease: 'linear' }}
          >
            <Layout className="w-5 h-5 text-indigo-600" />
          </motion.div>
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            {isGenerating ? 'ワイヤーフレームを生成中...' : 'ワイヤーフレームが完了しました'}
          </h3>
        </div>

        {/* リアルタイム生成ステップ */}
        <div className="mb-4 space-y-2">
          {wireframeStepDefinitions.map((step, index) => {
            const isActive = generationSteps.includes(step.key)
            const isCompleted = completedSteps.has(step.key)
            const Icon = step.icon
            
            if (!isActive && !isCompleted) return null

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-white/80 border-indigo-200'
                    : isActive
                      ? 'bg-indigo-100/50 border-indigo-300'
                      : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? 'bg-indigo-500 text-white'
                    : isActive
                      ? 'bg-indigo-200 text-indigo-700'
                      : 'bg-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    {step.label}
                  </div>
                  {isActive && !isCompleted && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-xs text-indigo-600 mt-1"
                    >
                      生成中...
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* 生成中のメッセージ */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 sm:mt-4 p-3 bg-indigo-100 rounded-xl border border-indigo-300"
          >
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="w-4 h-4 text-indigo-600" />
              </motion.div>
              <div className="text-xs font-bold text-indigo-900">
                {currentStepText || 'ワイヤーフレームを生成中...'}
              </div>
            </div>
            <div className="text-xs text-indigo-700 mt-1">
              PC/SP別のレイアウトを設計し、最適なワイヤーフレームを作成しています
            </div>
          </motion.div>
        )}

        {/* 生成完了メッセージ */}
        {!isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 sm:mt-4 p-3 bg-indigo-100 rounded-xl border border-indigo-300"
          >
            <div className="text-xs font-bold text-indigo-900 mb-1">✨ ワイヤーフレームが完了しました</div>
            <div className="text-xs text-indigo-700">このワイヤーフレームを基に、各セクションの画像を生成します</div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export function LpGenerationOverlay({
  open,
  progress,
  stageText,
  mood,
  steps,
  allowBackgroundView = false,
  productInfo,
  sections,
  currentStep,
}: LpGenerationOverlayProps) {
  const p = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [hasShownConfetti, setHasShownConfetti] = useState(false)

  // 完了時に紙吹雪
  useEffect(() => {
    if (p >= 100 && !hasShownConfetti && open) {
      setHasShownConfetti(true)
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6'],
      })
    }
  }, [p, hasShownConfetti, open])

  // ヒントのローテーション
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % loadingTips.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [open])

  // 経過時間のカウント
  useEffect(() => {
    if (!open) {
      setElapsedTime(0)
      return
    }
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentStepIndex = useMemo(() => {
    return Math.max(0, steps.findIndex((s) => p < s.threshold))
  }, [p, steps])

  const mascotAnim = useMemo(() => {
    // アニメーション仕様に基づいた動き
    if (mood === 'happy') {
      return {
        x: [-4, 4, -4],
        rotate: [-5, 5, -5],
        y: [0, -2, 0],
        transition: { repeat: Infinity, duration: 0.8, ease: 'easeInOut' },
      }
    }
    if (mood === 'search') {
      return {
        y: [0, -4, 0],
        rotate: [-2, 2, -2],
        transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' },
      }
    }
    if (mood === 'think') {
      return {
        y: [0, -8, 0],
        transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
      }
    }
    return { rotate: 0, y: 0 }
  }, [mood])

  return (
    <>
      {/* 動く背景 - パーティー演出 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[199]"
          >
            {/* グラデーション背景アニメーション */}
            <motion.div
              animate={{
                background: [
                  'radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.2) 0%, transparent 50%)',
                  'radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.2) 0%, transparent 50%)',
                  'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
                  'radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.2) 0%, transparent 50%)',
                ],
              }}
              transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
              className="absolute inset-0"
            />
            {/* 回転するブロブ1 */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-teal-400/25 to-cyan-400/25 blur-3xl"
            />
            {/* 上下に動くブロブ2 */}
            <motion.div
              animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-24 right-20 w-64 h-64 rounded-full bg-gradient-to-br from-cyan-300/25 to-blue-300/25 blur-2xl"
            />
            {/* 左右に動くブロブ3 */}
            <motion.div
              animate={{ x: [0, 15, 0], y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-32 left-16 w-48 h-48 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 blur-2xl"
            />
            {/* パルスするブロブ4 */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-gradient-to-br from-teal-300/15 to-cyan-300/15 blur-3xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* メインオーバーレイ */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[200] flex items-center justify-center px-4 ${
              allowBackgroundView 
                ? 'bg-slate-900/30 backdrop-blur-[2px]' 
                : 'bg-slate-900/60 backdrop-blur-sm'
            }`}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full max-w-4xl max-h-[90vh] rounded-3xl border-2 border-white/20 bg-white/98 backdrop-blur-xl shadow-2xl overflow-hidden relative flex flex-col"
            >
              {/* グローエフェクト - 派手なアニメーション */}
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-blue-500/20"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                />
                {/* 回転する光の帯 */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
                >
                  <div className="absolute top-0 left-1/2 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </motion.div>
                {/* パルスする光の点 */}
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: '100px',
                      height: '100px',
                      left: `${20 + i * 25}%`,
                      top: `${30 + (i % 2) * 40}%`,
                      background: `radial-gradient(circle, rgba(20, 184, 166, ${0.3 + i * 0.1}) 0%, transparent 70%)`,
                    }}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 0.8, 0.3],
                    }}
                    transition={{
                      duration: 2 + i * 0.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.3,
                    }}
                  />
                ))}
              </motion.div>
              <div className="relative z-10 flex flex-col h-full">
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* マスコットアイコン */}
                    <motion.div
                      animate={mascotAnim}
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-xl shadow-teal-500/40 relative overflow-hidden"
                    >
                      {/* グローエフェクト */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      />
                      {/* パルスするリング */}
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 rounded-2xl border-2 border-white/30"
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0, 0.5],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeOut',
                            delay: i * 0.7,
                          }}
                        />
                      ))}
                      <Globe className="w-7 h-7 text-white relative z-10" />
                    </motion.div>
                    <div className="w-11 h-11 rounded-2xl bg-white/80 border border-teal-200 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <div className="text-slate-900 font-black text-lg leading-tight">LP生成中</div>
                      <div className="text-teal-600 text-xs font-bold mt-1">{stageText}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 font-bold">
                      {formatTime(elapsedTime)}
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-teal-200 border-t-teal-500 animate-spin" />
                  </div>
                </div>
                
                {/* 時間がかかる旨のメッセージ */}
                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start sm:items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <p className="text-xs font-bold text-amber-700 leading-relaxed">
                      画像生成のため 2〜5分 ほどかかります。しばらくお待ちください。
                    </p>
                  </div>
                </div>

                {/* ステップインジケーター */}
                <div className="mt-4 flex items-center gap-1 sm:gap-2 flex-wrap">
                  {steps.map((s, i) => {
                    const active = p >= s.threshold
                    const isCurrent = i === currentStepIndex
                    const Icon = s.icon
                    return (
                      <div key={`${s.label}-${i}`} className="flex items-center gap-1 sm:gap-2">
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30 scale-110'
                            : active
                              ? 'bg-teal-100 text-teal-600'
                              : 'bg-gray-100 text-gray-300'
                        }`}>
                          {isCurrent ? (
                            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                          ) : (
                            <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                          )}
                        </div>
                        <div className={`text-[10px] sm:text-[11px] font-black ${active ? 'text-slate-900' : 'text-gray-400'} hidden sm:block`}>
                          {s.label}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`w-4 sm:w-6 h-px ${active ? 'bg-teal-300' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* プログレスバー */}
                <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200 shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 relative"
                  >
                    <motion.div
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    />
                  </motion.div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <span>進捗</span>
                  <span className="text-teal-600">{Math.round(p)}%</span>
                </div>
              </div>

              {/* コンテンツエリア */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
                {/* 商品理解のリアルタイム分析表示 */}
                {currentStep === 'product' && (
                  <ProductUnderstandingDisplay 
                    productInfo={productInfo}
                    isAnalyzing={!productInfo}
                  />
                )}

                {/* LP構成案生成のリアルタイム表示 */}
                {currentStep === 'structure' && (
                  <StructureGenerationDisplay 
                    sections={sections}
                    isGenerating={!sections || sections.length === 0}
                  />
                )}

                {/* ワイヤーフレーム生成のリアルタイム表示 */}
                {currentStep === 'wireframe' && (
                  <WireframeGenerationDisplay 
                    isGenerating={currentStep === 'wireframe'}
                  />
                )}

                {/* 検索UI（searchモード時のみ表示、商品理解完了前） */}
                {mood === 'search' && !productInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mb-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200/50 p-6 relative overflow-hidden"
                  >
                    {/* 背景パターン */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-0" style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #3b82f6 0, #3b82f6 1px, transparent 1px, transparent 10px)',
                      }} />
                    </div>
                    
                    <div className="relative z-10">
                      {/* 検索バー */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-4 flex items-center gap-3 bg-white rounded-xl border-2 border-blue-200 p-4 shadow-lg"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md"
                        >
                          <Search className="w-5 h-5 text-white" />
                        </motion.div>
                        <div className="flex-1 relative">
                          <motion.div
                            animate={{
                              width: ['0%', '100%', '0%'],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                            className="h-2 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full"
                          />
                          <div className="mt-2 text-sm text-gray-500 font-medium">
                            <motion.span
                              key={tipIndex}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="inline-block"
                            >
                              {loadingTips[0]?.replace('…', '') || '商品情報を分析中'}
                            </motion.span>
                            <motion.span
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="ml-1"
                            >
                              ...
                            </motion.span>
                          </div>
                        </div>
                      </motion.div>

                      {/* 検索結果風のカード */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.2, duration: 0.4 }}
                            className="bg-white/80 backdrop-blur-sm rounded-xl border border-blue-100 p-4 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <motion.div
                                animate={{
                                  scale: [1, 1.05, 1],
                                }}
                                transition={{
                                  duration: 1.5 + i * 0.3,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: i * 0.2,
                                }}
                                className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0 mt-0.5"
                              >
                                <FileText className="w-4 h-4 text-blue-600" />
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="h-3 bg-blue-200 rounded w-32 animate-pulse" />
                                  <ExternalLink className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                </div>
                                <div className="h-2 bg-gray-200 rounded w-full mb-2 animate-pulse" />
                                <div className="h-2 bg-gray-200 rounded w-3/4 animate-pulse" />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* 検索中メッセージ */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 flex items-center gap-2 text-xs text-blue-600 font-bold"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                          <Loader2 className="w-4 h-4" />
                        </motion.div>
                        <span>関連情報を検索中...</span>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* ステップカード */}
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  {steps.slice(0, 3).map((s, i) => {
                    const active = p >= s.threshold
                    const Icon = s.icon
                    return (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i, duration: 0.3, ease: 'easeOut' }}
                        className={`rounded-2xl border p-4 transition-all ${
                          active
                            ? 'bg-teal-50 border-teal-200 shadow-sm'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            active
                              ? 'bg-teal-500 text-white'
                              : 'bg-gray-200 text-gray-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className={`font-black text-sm ${active ? 'text-slate-900' : 'text-gray-400'}`}>
                            {s.label}
                          </div>
                        </div>
                        <div className={`text-xs font-bold ${active ? 'text-gray-600' : 'text-gray-400'}`}>
                          {active ? '完了' : '処理中...'}
                        </div>
                        {!active && (
                          <motion.div
                            key={p}
                            initial={{ x: '-40%' }}
                            animate={{ x: '140%' }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="mt-3 h-1 w-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-300 to-transparent"
                          />
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {/* ローテーションするヒント */}
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-5 border border-teal-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tipIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-start gap-4"
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-teal-600 uppercase tracking-[0.2em] mb-1">ドヤTip</p>
                        <p className="text-sm text-gray-700 font-medium leading-relaxed">
                          {loadingTips[tipIndex]}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

