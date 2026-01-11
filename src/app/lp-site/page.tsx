'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { LpSiteAppLayout } from '@/components/LpSiteAppLayout'
import { LpGenerationRequest, LpGenerationResult, LpType, Tone } from '@/lib/lp-site/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Download, RefreshCw, Monitor, Smartphone, Loader2, Search, Layout, Image as ImageIcon, Package, Globe, Eye, Globe2, Link2, Edit } from 'lucide-react'
import toast from 'react-hot-toast'
import { LpGenerationOverlay } from '@/components/lp-site/LpGenerationOverlay'
import { FigmaStyleEditor } from '@/components/lp-site/FigmaStyleEditor'

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
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({})
  const [generatingSections, setGeneratingSections] = useState<Set<string>>(new Set())
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

        // Step 4: 画像生成（バックグラウンドで実行、セクションごとに個別生成）
        setIsGeneratingImages(true)
        setImageProgress(0)
        setSectionProgress({})
        setGeneratingSections(new Set(sections.filter(s => s.image_required).map(s => s.section_id)))
        
        // 画像生成を非同期で実行（セクションごとに個別生成）
        ;(async () => {
          try {
            setCurrentStep('image')
            setImageProgress(0)
            updateProgress(65) // 画像生成開始
            setStageText('セクション画像を生成中...')
            setMood('think')
            
            const imageRequiredSections = sections.filter(s => s.image_required)
            const totalSections = imageRequiredSections.length
            let completedSections = 0
            const generatedImages: SectionImage[] = []
            
            // 各セクションごとに画像を生成
            for (let index = 0; index < imageRequiredSections.length; index++) {
              const section = imageRequiredSections[index]
              const sectionId = section.section_id
              
              try {
                // セクション生成開始
                setSectionProgress(prev => ({ ...prev, [sectionId]: 0 }))
                setStageText(`${section.headline || section.section_id} の画像を生成中... (${index + 1}/${totalSections})`)
                
                // セクション画像生成APIを呼び出し
                const sectionResponse = await fetch('/api/lp-site/regenerate-section', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    section,
                    product_info: productInfo,
                    regenerate_type: 'both', // PC/SP両方生成
                  }),
                })
                
                if (!sectionResponse.ok) {
                  const errorData = await sectionResponse.json().catch(() => ({}))
                  console.error(`[LP-SITE] セクション画像生成エラー (${sectionId}):`, errorData)
                  throw new Error(errorData.error || errorData.details || `セクション ${sectionId} の画像生成に失敗しました`)
                }
                
                const sectionData = await sectionResponse.json()
                const sectionImage: SectionImage = {
                  section_id: sectionId,
                  image_pc: sectionData.result?.image_pc,
                  image_sp: sectionData.result?.image_sp,
                }
                
                generatedImages.push(sectionImage)
                completedSections++
                
                // 進捗を更新
                const overallProgress = 65 + Math.round((completedSections / totalSections) * 30) // 65-95%
                updateProgress(overallProgress)
                setImageProgress(Math.round((completedSections / totalSections) * 100))
                setSectionProgress(prev => ({ ...prev, [sectionId]: 100 }))
                
                // 結果をリアルタイムで更新
                const currentImages = [...generatedImages]
                // 画像不要のセクションも追加
                sections.filter(s => !s.image_required).forEach(s => {
                  if (!currentImages.find(img => img.section_id === s.section_id)) {
                    currentImages.push({ section_id: s.section_id })
                  }
                })
                
                const partialResult: LpGenerationResult = {
                  product_info: productInfo,
                  sections,
                  wireframes,
                  images: currentImages,
                  structure_json: JSON.stringify({
                    product_info: productInfo,
                    sections,
                    wireframes,
                    images: currentImages.map(img => ({
                      section_id: img.section_id,
                      has_pc: !!img.image_pc,
                      has_sp: !!img.image_sp,
                    })),
                  }, null, 2),
                }
                
                setResult(partialResult) // リアルタイムで結果を更新
                setGeneratingSections(prev => {
                  const next = new Set(prev)
                  next.delete(sectionId)
                  return next
                })
                
                console.log(`[LP-SITE] セクション画像生成完了: ${sectionId} (${completedSections}/${totalSections})`)
              } catch (error: any) {
                console.error(`[LP-SITE] セクション画像生成エラー (${sectionId}):`, error)
                // エラーが発生しても続行
                generatedImages.push({
                  section_id: sectionId,
                  image_pc: undefined,
                  image_sp: undefined,
                })
                setGeneratingSections(prev => {
                  const next = new Set(prev)
                  next.delete(sectionId)
                  return next
                })
              }
            }
            
            // 画像不要のセクションも追加
            sections.filter(s => !s.image_required).forEach(s => {
              if (!generatedImages.find(img => img.section_id === s.section_id)) {
                generatedImages.push({ section_id: s.section_id })
              }
            })
            
            images = generatedImages
            
            updateProgress(100) // 画像生成完了
            setImageProgress(100)
            setStageText('完了！')
            setMood('happy')
            setSectionProgress({})
            setGeneratingSections(new Set())

            // 最終結果を更新
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

  // 結果がある場合はフルスクリーンのFigma風エディタを表示
  if (result) {
    return (
      <>
        {/* 生成中オーバーレイ */}
        <LpGenerationOverlay
          open={isGenerating}
          progress={progress}
          stageText={stageText}
          mood={mood}
          steps={steps}
          allowBackgroundView={true}
        />
        <FigmaStyleEditor
          result={result}
          selectedDevice={selectedDevice}
          onDeviceChange={setSelectedDevice}
          isGeneratingImages={isGeneratingImages}
          sectionProgress={sectionProgress}
          generatingSections={generatingSections}
          onSectionsReorder={(newSections) => {
            setResult({
              ...result,
              sections: newSections,
            })
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
          onPreview={async () => {
            if (!result) return
            try {
              const previewId = Date.now().toString(36) + Math.random().toString(36).slice(2)
              const response = await fetch(`/api/lp-site/preview/${previewId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
              })
              if (!response.ok) throw new Error('プレビューの保存に失敗しました')
              setPreviewId(previewId)
              window.open(`/lp-site/preview/${previewId}`, '_blank')
              toast.success('プレビューを開きました')
            } catch (error: any) {
              toast.error(error.message || 'プレビューの作成に失敗しました')
            }
          }}
          onPublish={async () => {
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
        />
        {/* 新しいLP生成ボタン（フローティング） */}
        <button
          onClick={() => setResult(null)}
          className="fixed bottom-6 right-6 z-50 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          新しいLPを生成
        </button>
      </>
    )
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
        allowBackgroundView={false}
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

        {/* Input Form */}
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
                {(['saas', 'ec', 'service', 'recruit', 'education', 'beauty', 'healthcare', 'finance'] as LpType[]).map((type, index) => (
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
                    {type === 'education' && '教育'}
                    {type === 'beauty' && '美容'}
                    {type === 'healthcare' && '医療'}
                    {type === 'finance' && '金融'}
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

