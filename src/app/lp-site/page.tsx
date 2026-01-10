'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { LpSiteAppLayout } from '@/components/LpSiteAppLayout'
import { LpGenerationRequest, LpGenerationResult, LpType, Tone } from '@/lib/lp-site/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Download, RefreshCw, Monitor, Smartphone, Loader2, Search, Layout, Image as ImageIcon, Package, Globe, Eye, Globe2, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { LpGenerationOverlay } from '@/components/lp-site/LpGenerationOverlay'
import { LpInteractiveEditor } from '@/components/lp-site/LpInteractiveEditor'

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
  const [combinedLpImage, setCombinedLpImage] = useState<{ pc?: string; sp?: string } | null>(null)
  const [isCombining, setIsCombining] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)

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
              const errorData = await step4Response.json().catch(() => ({}))
              console.error('[LP-SITE] 画像生成APIエラー:', errorData)
              throw new Error(errorData.error || errorData.details || '画像生成に失敗しました')
            }
            
            const step4Data = await step4Response.json()
            console.log('[LP-SITE] 画像生成レスポンス:', {
              imagesCount: step4Data.images?.length,
              images: step4Data.images?.map((img: any) => ({
                section_id: img.section_id,
                has_pc: !!img.image_pc,
                has_sp: !!img.image_sp,
              })),
            })
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
            console.error('[LP-SITE] 画像生成エラー:', error)
            console.error('[LP-SITE] エラー詳細:', error.message, error.stack)
            setIsGeneratingImages(false)
            setImageProgress(0)
            const errorMessage = error.message || '画像生成に失敗しました'
            toast.error(`${errorMessage}。ワイヤーフレームは表示できます。`, { duration: 5000 })
            
            // エラーが発生しても、部分的に生成された画像があれば表示
            if (images && images.length > 0) {
              const partialResult: LpGenerationResult = {
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
              setResult(partialResult)
              toast.warning('一部の画像は生成されましたが、エラーが発生しました')
            }
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

      // 画像がまだない場合は新規追加
      const hasExistingImage = result.images.some(img => img.section_id === sectionId)
      const finalImages = hasExistingImage
        ? updatedImages
        : [
            ...result.images,
            {
              section_id: sectionId,
              image_pc: data.result.image_pc,
              image_sp: data.result.image_sp,
            },
          ]

      setResult({
        ...result,
        images: finalImages,
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/30 flex-shrink-0"
            >
              <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
                ドヤサイト
              </h1>
              <p className="text-slate-600 mt-1 text-xs sm:text-sm">
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
            className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-4 sm:p-6 md:p-8 relative overflow-hidden"
          >
            {/* 装飾的な背景 */}
            <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-gradient-to-br from-teal-100/20 to-cyan-100/20 rounded-full blur-3xl -mr-32 sm:-mr-48 -mt-32 sm:-mt-48 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 sm:w-96 sm:h-96 bg-gradient-to-tr from-blue-100/20 to-purple-100/20 rounded-full blur-3xl -ml-32 sm:-ml-48 -mb-32 sm:-mb-48 pointer-events-none" />
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="mt-8"
            >
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-5 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-teal-500/30 hover:shadow-2xl hover:shadow-teal-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group"
              >
                {/* シマーエフェクト */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                />
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin relative z-10" />
                    <span className="relative z-10">生成中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6 relative z-10" />
                    <span className="relative z-10">LPを生成する</span>
                  </>
                )}
              </motion.button>
            </motion.div>
            </div>
          </motion.div>
        ) : (
          /* Result Preview */
          <div className="space-y-6">
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
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">表示:</span>
                  <button
                    onClick={() => setSelectedDevice('pc')}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
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
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      selectedDevice === 'sp'
                        ? 'bg-teal-500 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    スマホ
                  </button>
                </div>
                <div className="flex-1 hidden sm:block" />
                <button
                  onClick={() => handleDownload(selectedDevice === 'pc' ? 'all_pc' : 'all_sp')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-teal-600 transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">全体ZIPダウンロード</span>
                  <span className="sm:hidden">ZIPダウンロード</span>
                </button>
              </div>
            </div>

            {/* LP全体プレビュー（縦につなげた形） */}
            {result.images.some(img => selectedDevice === 'pc' ? img.image_pc : img.image_sp) && (
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Layout className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                    <span className="text-sm sm:text-base">LP全体画像（{selectedDevice === 'pc' ? 'PC' : 'スマホ'}版）</span>
                  </h3>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
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
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg text-xs sm:text-sm font-bold hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
                    >
                      {isCombining ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="whitespace-nowrap">生成中...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span className="whitespace-nowrap">LP全体画像を生成</span>
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

            {/* ワイヤーフレーム表示（縦並び） */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Layout className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                <span className="text-sm sm:text-base">ワイヤーフレーム構成（{selectedDevice === 'pc' ? 'PC' : 'スマホ'}版）</span>
              </h3>
              <div className="space-y-6">
                {result.sections.map((section, index) => {
                  const wireframe = result.wireframes.find(w => w.section_id === section.section_id)
                  const wireframeData = selectedDevice === 'pc' ? wireframe?.pc : wireframe?.sp
                  
                  return (
                    <motion.div
                      key={section.section_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-2 border-slate-200 rounded-xl p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-white hover:border-teal-400 hover:shadow-lg transition-all"
                    >
                      {/* ヘッダー部分 */}
                      <div className="flex items-start gap-3 sm:gap-4 mb-4">
                        {/* 番号バッジ */}
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-black text-base sm:text-lg shadow-md">
                          {index + 1}
                        </div>
                        
                        {/* タイトルと説明 */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1 break-words">
                            {section.headline}
                          </h4>
                          {section.sub_headline && (
                            <p className="text-xs sm:text-sm text-slate-600 mb-2 break-words">
                              {section.sub_headline}
                            </p>
                          )}
                          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed break-words">
                            {section.purpose}
                          </p>
                          {/* セクションタイプのバッジ */}
                          <div className="mt-2 inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] sm:text-xs font-semibold rounded-md">
                            {section.section_type}
                          </div>
                        </div>
                      </div>
                      
                      {/* ワイヤーフレームプレースホルダー */}
                      <div className="bg-white rounded-lg p-4 sm:p-6 border-2 border-dashed border-slate-300 min-h-[200px] sm:min-h-[300px] flex items-center justify-center">
                        {wireframeData ? (
                          <div className="w-full text-center">
                            <div className="text-sm sm:text-base text-slate-400 mb-2">
                              <Layout className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 opacity-60" />
                              <div className="font-semibold">ワイヤーフレーム</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-slate-400">
                            <Layout className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 opacity-40" />
                            <div className="text-xs sm:text-sm">ワイヤーフレームデータなし</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* インタラクティブエディタ */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <Edit className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                  <span>セクションエディタ</span>
                </h3>
                <p className="text-sm text-slate-600">
                  セクションをクリックして編集・再生成。ドラッグ&ドロップで並び替えができます。
                </p>
              </div>
              <LpInteractiveEditor
                result={result}
                selectedDevice={selectedDevice}
                onSectionsReorder={(newSections) => {
                  setResult({
                    ...result,
                    sections: newSections,
                  })
                  toast.success('セクションの順序を変更しました')
                }}
                onSectionRegenerate={async (sectionId) => {
                  try {
                    await handleRegenerateSection(sectionId, selectedDevice === 'pc' ? 'image_pc' : 'image_sp')
                  } catch (error) {
                    // エラーはhandleRegenerateSection内で処理済み
                  }
                }}
                onDownload={handleDownload}
                onSectionUpdate={(sectionId, field, value) => {
                  setResult({
                    ...result,
                    sections: result.sections.map((s) =>
                      s.section_id === sectionId ? { ...s, [field]: value } : s
                    ),
                  })
                }}
              />
            </div>

            {/* アクションボタン */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-teal-600" />
                <span>アクション</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* プレビュー */}
                <button
                  onClick={async () => {
                    if (!result) return
                    try {
                      const previewId = Date.now().toString(36) + Math.random().toString(36).substr(2)
                      const response = await fetch(`/api/lp-site/preview/${previewId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(result),
                      })
                      if (!response.ok) throw new Error('プレビューの保存に失敗しました')
                      const data = await response.json()
                      setPreviewId(previewId)
                      window.open(`/lp-site/preview/${previewId}`, '_blank')
                      toast.success('プレビューを開きました')
                    } catch (error: any) {
                      toast.error(error.message || 'プレビューの作成に失敗しました')
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
                >
                  <Eye className="w-5 h-5" />
                  <span>プレビュー</span>
                </button>

                {/* 公開 */}
                <button
                  onClick={async () => {
                    if (!result) return
                    setIsPublishing(true)
                    try {
                      const response = await fetch('/api/lp-site/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lp_data: result }),
                      })
                      if (!response.ok) throw new Error('公開に失敗しました')
                      const data = await response.json()
                      setPublishedUrl(data.published_url)
                      setResult({
                        ...result,
                        published_url: data.published_url,
                      })
                      toast.success('LPを公開しました！')
                      window.open(data.published_url, '_blank')
                    } catch (error: any) {
                      toast.error(error.message || '公開に失敗しました')
                    } finally {
                      setIsPublishing(false)
                    }
                  }}
                  disabled={isPublishing}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>公開中...</span>
                    </>
                  ) : (
                    <>
                      <Globe2 className="w-5 h-5" />
                      <span>サイト公開</span>
                    </>
                  )}
                </button>

                {/* 画像ダウンロード（全体） */}
                <button
                  onClick={() => {
                    if (!combinedLpImage) {
                      toast.error('まずLP全体画像を生成してください')
                      return
                    }
                    const image = selectedDevice === 'pc' ? combinedLpImage.pc : combinedLpImage.sp
                    if (image) {
                      handleDownload('single', 'lp-combined', image)
                    }
                  }}
                  disabled={!combinedLpImage}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-5 h-5" />
                  <span>全体画像ダウンロード</span>
                </button>

                {/* 全セクション画像ZIP */}
                <button
                  onClick={() => handleDownload(selectedDevice === 'pc' ? 'all_pc' : 'all_sp')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>全画像ZIP ({selectedDevice === 'pc' ? 'PC' : 'SP'}版)</span>
                </button>
              </div>

              {/* 公開URL表示 */}
              {publishedUrl && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-bold text-green-900 mb-2">公開URL:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={publishedUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publishedUrl)
                        toast.success('URLをコピーしました')
                      }}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                    >
                      コピー
                    </button>
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                    >
                      開く
                    </a>
                  </div>
                </div>
              )}
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

