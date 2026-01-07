'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { LpSiteAppLayout } from '@/components/LpSiteAppLayout'
import { LpGenerationRequest, LpGenerationResult, LpType, Tone } from '@/lib/lp-site/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Download, RefreshCw, Monitor, Smartphone, Loader2, Search, Layout, Image as ImageIcon, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { LpGenerationOverlay } from '@/components/lp-site/LpGenerationOverlay'
import { PasonaFrameworkView } from '@/components/lp-site/PasonaFrameworkView'

function LpSitePageInner() {
  const [inputType, setInputType] = useState<'url' | 'form'>('url')
  const [url, setUrl] = useState('')
  const [formData, setFormData] = useState({
    product_name: '',
    product_summary: '',
    target: '',
    problem: '',
    strength: '',
    cta: '',
  })
  const [lpType, setLpType] = useState<LpType>('saas')
  const [tone, setTone] = useState<Tone>('trust')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<LpGenerationResult | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'sp'>('pc')
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stageText, setStageText] = useState('準備中...')
  const [mood, setMood] = useState<'idle' | 'search' | 'think' | 'happy'>('idle')
  const [apiCompleted, setApiCompleted] = useState(false)
  const [apiResult, setApiResult] = useState<LpGenerationResult | null>(null)
  const [partialResult, setPartialResult] = useState<Partial<LpGenerationResult> | null>(null)
  const [currentStep, setCurrentStep] = useState<'product' | 'structure' | 'wireframe' | 'image' | 'complete'>('product')
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)
  const [showFramework, setShowFramework] = useState(false)
  const [combinedLpImage, setCombinedLpImage] = useState<{ pc?: string; sp?: string } | null>(null)
  const [isCombining, setIsCombining] = useState(false)

  // 進捗を安全に更新（後戻りしない）
  const updateProgress = (newProgress: number) => {
    setProgress((prev) => Math.max(prev, Math.min(100, newProgress)))
  }

  const steps = [
    { label: '商品理解', threshold: 20, icon: Search },
    { label: 'LP構成生成', threshold: 40, icon: Layout },
    { label: 'ワイヤーフレーム', threshold: 60, icon: Layout },
    { label: '画像生成', threshold: 90, icon: ImageIcon },
    { label: 'アセット整理', threshold: 100, icon: Package },
  ]

  // 進捗リセット（生成開始時のみ）
  useEffect(() => {
    if (!isGenerating) {
      // 画像生成中でない場合のみ進捗をリセット
      if (!isGeneratingImages) {
        setProgress(0)
      }
      setStageText('準備中...')
      setMood('idle')
      setApiCompleted(false)
      setApiResult(null)
    }
  }, [isGenerating, isGeneratingImages])

  // API完了時に進捗を100%にして結果を表示
  useEffect(() => {
    if (!isGenerating || !apiCompleted || !apiResult) return
    
    // API完了時は確実に100%にする
    if (progress < 100) {
      setProgress(100)
      setStageText('完了！')
      setMood('happy')
      return
    }
    
    // 進捗が100%でAPI完了している場合は結果を表示
    if (progress >= 100 && apiCompleted && apiResult) {
      console.log('[LP-SITE] 完了条件を満たしました。結果を表示します。')
      // 紙吹雪が表示されるのを待ってから結果を表示
      const timer = setTimeout(() => {
        console.log('[LP-SITE] 結果を設定します')
        setResult(apiResult)
        setIsGenerating(false)
        setProgress(0)
        setStageText('準備中...')
        setMood('idle')
        setApiCompleted(false)
        setApiResult(null)
        setPartialResult(null)
        toast.success('LP生成が完了しました！')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [progress, apiCompleted, apiResult, isGenerating])

  const handleGenerate = async () => {
    if (inputType === 'url' && !url) {
      toast.error('URLを入力してください')
      return
    }
    if (inputType === 'form' && !formData.product_name) {
      toast.error('商品名を入力してください')
      return
    }

    setIsGenerating(true)
    setResult(null)
    setProgress(0)
    setStageText('準備中...')
    setMood('idle')
    setApiCompleted(false)
    setApiResult(null)
    setPartialResult(null)

    try {
      const request: LpGenerationRequest = {
        input_type: inputType,
        url: inputType === 'url' ? url : undefined,
        form_data: inputType === 'form' ? formData : undefined,
        lp_type: lpType,
        tone,
      }

      // 段階的にAPIを呼び出して途中結果を表示
      let productInfo: any = null
      let sections: any[] = []
      let wireframes: any[] = []
      let images: any[] = []

      try {
        // Step 1: 商品理解 (0-20%)
        setCurrentStep('product')
        updateProgress(5)
        setStageText('商品情報を分析中...')
        setMood('search')
        
        const step1Response = await fetch('/api/lp-site/generate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'product-understanding', request_data: request }),
        })
        if (!step1Response.ok) throw new Error('商品理解に失敗しました')
        const step1Data = await step1Response.json()
        productInfo = step1Data.product_info
        updateProgress(20) // Step 1完了

        // Step 2: LP構成生成 (20-40%)
        setCurrentStep('structure')
        updateProgress(25)
        setStageText('LP構成案を生成中...')
        setMood('think')
        
        const step2Response = await fetch('/api/lp-site/generate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'structure-generation', product_info: productInfo }),
        })
        if (!step2Response.ok) throw new Error('LP構成生成に失敗しました')
        const step2Data = await step2Response.json()
        sections = step2Data.sections
        updateProgress(40) // Step 2完了

        // Step 3: ワイヤーフレーム生成 (40-60%)
        setCurrentStep('wireframe')
        updateProgress(45)
        setStageText('ワイヤーフレームを生成中...')
        setMood('think')
        
        const step3Response = await fetch('/api/lp-site/generate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'wireframe-generation', product_info: productInfo, sections }),
        })
        if (!step3Response.ok) throw new Error('ワイヤーフレーム生成に失敗しました')
        const step3Data = await step3Response.json()
        wireframes = step3Data.wireframes
        updateProgress(60) // Step 3完了

        // ワイヤーフレームが生成されたら、すぐに結果を表示（オーバーレイを閉じる）
        const wireframeResult: LpGenerationResult = {
          product_info: productInfo,
          sections,
          wireframes,
          images: [],
          structure_json: JSON.stringify({ product_info: productInfo, sections, wireframes }, null, 2),
        }
        setPartialResult(wireframeResult)
        setResult(wireframeResult)
        setIsGenerating(false) // オーバーレイを閉じる
        // 進捗はリセットしない（60%のまま維持）
        setStageText('準備中...')
        setMood('idle')
        toast.success('ワイヤーフレームが生成されました！画像を自動生成中...')

        // Step 4: 画像生成（バックグラウンドで実行）
        setIsGeneratingImages(true)
        setImageProgress(0)
        
        // 画像生成を非同期で実行
        ;(async () => {
          try {
            setCurrentStep('image')
            setImageProgress(0)
            updateProgress(65) // 画像生成開始
            setStageText('セクション画像を生成中...')
            setMood('think')
            
            // 画像生成の進捗を段階的に更新（60-100%）
            const progressSteps = [70, 75, 80, 85, 90, 95]
            let progressIndex = 0
            const progressInterval = setInterval(() => {
              if (progressIndex < progressSteps.length) {
                const progressValue = progressSteps[progressIndex]
                updateProgress(progressValue) // 後戻りしないように安全に更新
                setImageProgress(Math.round(((progressValue - 60) / 40) * 100)) // 60-100%を0-100%に変換
                progressIndex++
              } else {
                clearInterval(progressInterval)
              }
            }, 2000) // 2秒ごとに進捗を更新

            const step4Response = await fetch('/api/lp-site/generate-step', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ step: 'image-generation', product_info: productInfo, sections }),
            })
            
            clearInterval(progressInterval)
            updateProgress(100) // 画像生成完了（後戻りしない）
            setImageProgress(100)
            setStageText('完了！')
            setMood('happy')
            
            if (!step4Response.ok) {
              throw new Error('画像生成に失敗しました')
            }
            
            const step4Data = await step4Response.json()
            images = step4Data.images

            // 画像を追加して結果を更新
            const finalResult: LpGenerationResult = {
              product_info: productInfo,
              sections,
              wireframes,
              images,
              structure_json: JSON.stringify({
                product_info: productInfo,
                sections,
                wireframes,
                images: images.map(img => ({
                  section_id: img.section_id,
                  has_pc: !!img.image_pc,
                  has_sp: !!img.image_sp,
                })),
              }, null, 2),
            }
            
            setResult(finalResult) // 結果を更新（画像を追加）
            setImageProgress(100)
            setIsGeneratingImages(false)
            toast.success('すべての画像が生成されました！')
          } catch (error: any) {
            console.error('画像生成エラー:', error)
            setIsGeneratingImages(false)
            setImageProgress(0)
            toast.error('画像生成に失敗しましたが、ワイヤーフレームは表示できます')
          }
        })()
      } catch (error: any) {
        console.error('生成エラー:', error)
        // 途中まで完了している場合は、部分的な結果を表示
        if (sections.length > 0) {
          const partialResult: Partial<LpGenerationResult> = {
            product_info: productInfo,
            sections,
            wireframes,
            images: [],
            structure_json: JSON.stringify({ product_info: productInfo, sections, wireframes }, null, 2),
          }
          setPartialResult(partialResult)
          setResult(partialResult as LpGenerationResult)
          setIsGenerating(false)
          toast.warning('一部の処理に失敗しましたが、完了した部分は表示できます')
        } else {
          setIsGenerating(false)
          toast.error(error.message || '生成に失敗しました')
        }
      }
    } catch (error: any) {
      console.error('生成エラー:', error)
      setIsGenerating(false)
      setApiCompleted(false)
      setApiResult(null)
      setProgress(0)
      toast.error(error.message || '生成に失敗しました')
    }
  }

  const handleRegenerateSection = async (sectionId: string, type: 'image_pc' | 'image_sp' | 'both') => {
    if (!result) return

    try {
      const section = result.sections.find(s => s.section_id === sectionId)
      if (!section) return

      toast.loading('再生成中...', { id: `regenerate-${sectionId}` })

      const response = await fetch('/api/lp-site/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          product_info: result.product_info,
          regenerate_type: type,
        }),
      })

      if (!response.ok) {
        throw new Error('再生成に失敗しました')
      }

      const data = await response.json()
      
      // 結果を更新
      const updatedImages = result.images.map(img => {
        if (img.section_id === sectionId) {
          return {
            ...img,
            image_pc: data.result.image_pc || img.image_pc,
            image_sp: data.result.image_sp || img.image_sp,
          }
        }
        return img
      })

      setResult({
        ...result,
        images: updatedImages,
      })

      toast.success('再生成が完了しました', { id: `regenerate-${sectionId}` })
    } catch (error: any) {
      toast.error(error.message || '再生成に失敗しました', { id: `regenerate-${sectionId}` })
    }
  }

  const handleDownload = async (type: 'single' | 'section' | 'all_pc' | 'all_sp', sectionId?: string, imageData?: string) => {
    if (!result) return

    try {
      const response = await fetch('/api/lp-site/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          download_type: type,
          section_id: sectionId,
          image_data: imageData,
          all_data: result,
        }),
      })

      if (!response.ok) {
        throw new Error('ダウンロードに失敗しました')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      if (type === 'single') {
        a.download = `lp-image-${sectionId || 'image'}.png`
      } else if (type === 'section') {
        a.download = `lp-section-${sectionId}.zip`
      } else {
        a.download = `lp-${type === 'all_pc' ? 'pc' : 'sp'}-all.zip`
      }
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('ダウンロードが完了しました')
    } catch (error: any) {
      toast.error(error.message || 'ダウンロードに失敗しました')
    }
  }

  return (
    <LpSiteAppLayout>
      {/* 生成中オーバーレイ */}
            <LpGenerationOverlay
              open={isGenerating}
              progress={progress}
              stageText={stageText}
              mood={mood}
              steps={steps}
              allowBackgroundView={!!result} // 結果がある場合は背景を表示可能に
            />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/30"
            >
              <Globe className="w-8 h-8 text-white" />
            </motion.div>
            <div className="flex-1">
              <h1 className="text-4xl font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
                ドヤサイト
              </h1>
              <p className="text-slate-600 mt-1 text-sm">
                商品URLまたは商品情報を入力するだけで、LP構成案・ワイヤーフレーム・画像を自動生成
              </p>
            </div>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-black rounded-full shadow-lg"
            >
              ベータ版
            </motion.span>
          </div>
        </motion.div>

        {!result ? (
          /* Input Form */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-6 md:p-8 relative overflow-hidden"
          >
            {/* 装飾的な背景 */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-100/20 to-cyan-100/20 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-100/20 to-purple-100/20 rounded-full blur-3xl -ml-48 -mb-48 pointer-events-none" />
            <div className="relative z-10">
            {/* Input Type Selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mb-6"
            >
              <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                入力方法
              </label>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputType('url')}
                  className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all relative overflow-hidden ${
                    inputType === 'url'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {inputType === 'url' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">URL入力</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInputType('form')}
                  className={`flex-1 px-6 py-4 rounded-xl font-bold transition-all relative overflow-hidden ${
                    inputType === 'form'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {inputType === 'form' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">フォーム入力</span>
                </motion.button>
              </div>
            </motion.div>

            {/* URL Input */}
            {inputType === 'url' && (
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  商品URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/product"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}

            {/* Form Input */}
            {inputType === 'form' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    商品名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="例: プロジェクト管理ツール"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    商品概要
                  </label>
                  <textarea
                    value={formData.product_summary}
                    onChange={(e) => setFormData({ ...formData, product_summary: e.target.value })}
                    placeholder="商品の概要を入力してください"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ターゲット
                  </label>
                  <input
                    type="text"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    placeholder="例: 中小企業のマーケター"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    解決する課題
                  </label>
                  <textarea
                    value={formData.problem}
                    onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                    placeholder="例: プロジェクト管理が煩雑で効率が悪い"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    強み（USP）
                  </label>
                  <input
                    type="text"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    placeholder="例: 直感的なUIで誰でも使える"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    CTA（行動喚起）
                  </label>
                  <input
                    type="text"
                    value={formData.cta}
                    onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                    placeholder="例: 今すぐ無料で始める"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {/* LP Type Selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="mb-6"
            >
              <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Layout className="w-4 h-4 text-teal-600" />
                LPタイプ
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['saas', 'ec', 'service', 'recruit'] as LpType[]).map((type, index) => (
                  <motion.button
                    key={type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.05, duration: 0.2 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLpType(type)}
                    className={`px-4 py-3 rounded-xl font-bold transition-all relative overflow-hidden ${
                      lpType === type
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-md'
                    }`}
                  >
                    {type === 'saas' && 'SaaS'}
                    {type === 'ec' && 'EC'}
                    {type === 'service' && '無形サービス'}
                    {type === 'recruit' && '採用/広報'}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Tone Selection - 後回し */}
            {/* トーン選択は後で実装 */}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  生成する
                </>
              )}
            </button>
          </motion.div>
        ) : (
          /* Result Preview */
          <div className="space-y-6">
            {/* フレームワーク表示ボタン */}
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">PASONAフレームワーク</h3>
                  <p className="text-sm text-slate-600">生成されたLPの構成をフレームワークで確認</p>
                </div>
                <button
                  onClick={() => setShowFramework(!showFramework)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-bold hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl"
                >
                  <Layout className="w-5 h-5" />
                  {showFramework ? 'フレームワークを閉じる' : 'フレームワークを表示'}
                </button>
              </div>
            </div>

            {/* フレームワーク表示 */}
            {showFramework && result && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <PasonaFrameworkView sections={result.sections} />
              </motion.div>
            )}

            {/* 部分的な結果がある場合の警告 */}
            {partialResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900 mb-1">
                      一部の画像は生成中です
                    </p>
                    <p className="text-xs text-amber-700">
                      構成とワイヤーフレームは表示できます。画像は生成完了次第、自動的に表示されます。
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Device Toggle */}
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-700">表示:</span>
                <button
                  onClick={() => setSelectedDevice('pc')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedDevice === 'pc'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  PC
                </button>
                <button
                  onClick={() => setSelectedDevice('sp')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedDevice === 'sp'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  スマホ
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => handleDownload(selectedDevice === 'pc' ? 'all_pc' : 'all_sp')}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  全体ZIPダウンロード
                </button>
              </div>
            </div>

            {/* LP全体プレビュー（縦につなげた形） */}
            {result.images.some(img => selectedDevice === 'pc' ? img.image_pc : img.image_sp) && (
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Layout className="w-6 h-6 text-teal-600" />
                    LP全体画像（{selectedDevice === 'pc' ? 'PC' : 'スマホ'}版）
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setIsCombining(true)
                        try {
                          const response = await fetch('/api/lp-site/combine', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              images: result.images,
                              device: selectedDevice,
                            }),
                          })
                          if (!response.ok) throw new Error('結合に失敗しました')
                          const data = await response.json()
                          if (selectedDevice === 'pc') {
                            setCombinedLpImage({ ...combinedLpImage, pc: data.combined_image })
                          } else {
                            setCombinedLpImage({ ...combinedLpImage, sp: data.combined_image })
                          }
                          toast.success('LP全体画像を生成しました！')
                        } catch (error: any) {
                          toast.error(error.message || '結合に失敗しました')
                        } finally {
                          setIsCombining(false)
                        }
                      }}
                      disabled={isCombining}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-bold hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCombining ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          LP全体画像を生成
                        </>
                      )}
                    </button>
                    {(selectedDevice === 'pc' ? combinedLpImage?.pc : combinedLpImage?.sp) && (
                      <button
                        onClick={() => {
                          const image = selectedDevice === 'pc' ? combinedLpImage?.pc : combinedLpImage?.sp
                          if (image) {
                            handleDownload('single', 'lp-combined', image)
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-bold hover:bg-teal-600 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        ダウンロード
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 生成されたLP全体画像またはプレビュー */}
                {(selectedDevice === 'pc' ? combinedLpImage?.pc : combinedLpImage?.sp) ? (
                  <div className="border-4 border-teal-200 rounded-xl overflow-hidden bg-white shadow-xl">
                    <img
                      src={selectedDevice === 'pc' ? combinedLpImage?.pc : combinedLpImage?.sp}
                      alt="LP全体画像"
                      className="w-full block"
                    />
                  </div>
                ) : (
                  <div className="border-4 border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="space-y-0">
                      {result.sections.map((section, index) => {
                        const image = result.images.find(img => img.section_id === section.section_id)
                        const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
                        if (!imageData) return null
                        
                        return (
                          <div key={section.section_id} className="relative">
                            <img
                              src={imageData}
                              alt={section.headline}
                              className="w-full block"
                            />
                            {/* セクション区切り線 */}
                            {index < result.sections.length - 1 && (
                              <div className="h-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-slate-600 mt-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-500" />
                  <span>
                    {combinedLpImage ? 
                      '生成されたLP全体画像です。これをそのままLPとして使用できます。' :
                      '「LP全体画像を生成」ボタンで全セクションを縦につなげた完全なLP画像を生成できます。'}
                  </span>
                </p>
              </div>
            )}

            {/* ワイヤーフレーム表示（3段グリッド） */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Layout className="w-6 h-6 text-teal-600" />
                ワイヤーフレーム構成（{selectedDevice === 'pc' ? 'PC' : 'スマホ'}版）
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {result.sections.map((section, index) => {
                  const wireframe = result.wireframes.find(w => w.section_id === section.section_id)
                  const wireframeData = selectedDevice === 'pc' ? wireframe?.pc : wireframe?.sp
                  
                  return (
                    <motion.div
                      key={section.section_id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-2 border-slate-300 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white hover:border-teal-400 hover:shadow-md transition-all"
                    >
                      <div className="text-center mb-3">
                        <div className="inline-block px-3 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full mb-2">
                          {index + 1}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-2">
                          {section.headline}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {section.purpose}
                        </p>
                      </div>
                      {wireframeData && (
                        <div className="bg-white rounded-lg p-2 border border-slate-200 min-h-[120px] flex items-center justify-center">
                          <div className="text-xs text-slate-400 text-center">
                            <Layout className="w-8 h-8 mx-auto mb-1 opacity-50" />
                            <div>ワイヤーフレーム</div>
                            <div className="text-[10px] mt-1">{section.section_type}</div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* セクション詳細 */}
            <div className="space-y-6">
              {result.sections.map((section, index) => {
                const image = result.images.find(img => img.section_id === section.section_id)
                const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
                const hasImage = !!imageData

                return (
                  <motion.div
                    key={section.section_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-2xl shadow-lg p-6 border-2 border-slate-200"
                  >
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-black text-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-900 mb-1">
                            {section.headline}
                          </h3>
                          {section.sub_headline && (
                            <p className="text-slate-600">{section.sub_headline}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 mt-2 pl-13">
                        {section.purpose}
                      </p>
                    </div>

                    {hasImage ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="mb-4"
                      >
                        <img
                          src={imageData}
                          alt={section.headline}
                          className="w-full rounded-xl border border-slate-200 shadow-md"
                        />
                      </motion.div>
                    ) : section.image_required && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-4 p-8 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-dashed border-teal-300 flex items-center justify-center"
                      >
                        <div className="text-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="inline-block mb-2"
                          >
                            <ImageIcon className="w-12 h-12 text-teal-400" />
                          </motion.div>
                          <p className="text-sm font-bold text-teal-700">画像生成中...</p>
                          <p className="text-xs text-teal-500 mt-1">
                            {isGeneratingImages ? `${imageProgress}% 完了` : 'まもなく表示されます'}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    <div className="flex items-center gap-2">
                      {section.image_required && (
                        <>
                          <button
                            onClick={() => handleRegenerateSection(section.section_id, selectedDevice === 'pc' ? 'image_pc' : 'image_sp')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                            画像を再生成
                          </button>
                          {imageData && (
                            <button
                              onClick={() => handleDownload('single', section.section_id, imageData)}
                              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              画像をダウンロード
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => handleDownload('section', section.section_id)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        セクションZIP
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Back Button */}
            <button
              onClick={() => setResult(null)}
              className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              新しいLPを生成
            </button>
          </div>
        )}
      </div>
    </LpSiteAppLayout>
  )
}

export default function LpSitePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LpSitePageInner />
    </Suspense>
  )
}

