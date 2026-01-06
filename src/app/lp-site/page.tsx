'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { LpSiteAppLayout } from '@/components/LpSiteAppLayout'
import { LpGenerationRequest, LpGenerationResult, LpType, Tone } from '@/lib/lp-site/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Download, RefreshCw, Monitor, Smartphone, Loader2, Search, Layout, Image as ImageIcon, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { LpGenerationOverlay } from '@/components/lp-site/LpGenerationOverlay'

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

  const steps = [
    { label: '商品理解', threshold: 20, icon: Search },
    { label: 'LP構成生成', threshold: 40, icon: Layout },
    { label: 'ワイヤーフレーム', threshold: 60, icon: Layout },
    { label: '画像生成', threshold: 90, icon: ImageIcon },
    { label: 'アセット整理', threshold: 100, icon: Package },
  ]

  // 進捗シミュレーション
  useEffect(() => {
    if (!isGenerating) {
      setProgress(0)
      setStageText('準備中...')
      setMood('idle')
      setApiCompleted(false)
      setApiResult(null)
      return
    }

    let currentProgress = 0
    const maxProgress = 95 // 最大95%まで（API完了時に100%にする）
    const interval = setInterval(() => {
      // 進捗が遅くなるように調整（後半は遅く）
      let increment = 0.6
      if (currentProgress > 70) increment = 0.2
      else if (currentProgress > 50) increment = 0.4
      else if (currentProgress > 30) increment = 0.5
      
      currentProgress += increment
      
      // 最大95%までに制限
      if (currentProgress >= maxProgress) {
        currentProgress = maxProgress
        setStageText('最終調整中...')
        setMood('think')
        setProgress(maxProgress)
        clearInterval(interval)
        return
      }
      
      if (currentProgress < 20) {
        setStageText('商品情報を分析中...')
        setMood('search')
      } else if (currentProgress < 40) {
        setStageText('LP構成案を生成中...')
        setMood('think')
      } else if (currentProgress < 60) {
        setStageText('ワイヤーフレームを生成中...')
        setMood('think')
      } else if (currentProgress < 80) {
        setStageText('セクション画像を生成中...')
        setMood('think')
      } else {
        setStageText('最終調整中...')
        setMood('think')
      }

      setProgress(Math.min(maxProgress, currentProgress))
    }, 200)

    return () => clearInterval(interval)
  }, [isGenerating])

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
        // Step 1: 商品理解
        setCurrentStep('product')
        setProgress(10)
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

        // Step 2: LP構成生成
        setCurrentStep('structure')
        setProgress(30)
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

        // Step 3: ワイヤーフレーム生成
        setCurrentStep('wireframe')
        setProgress(50)
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

        // ここで途中結果を表示（構成とワイヤーフレーム）
        const partialResult: Partial<LpGenerationResult> = {
          product_info: productInfo,
          sections,
          wireframes,
          images: [],
          structure_json: JSON.stringify({ product_info: productInfo, sections, wireframes }, null, 2),
        }
        setPartialResult(partialResult)
        setResult(partialResult as LpGenerationResult)
        // 生成中でも結果を表示できるようにする（オーバーレイは表示し続ける）
        toast.success('構成とワイヤーフレームが生成されました！画像生成を続けます...')

        // Step 4: 画像生成（時間がかかる）
        setCurrentStep('image')
        setProgress(70)
        setStageText('セクション画像を生成中...')
        setMood('think')
        
        const step4Response = await fetch('/api/lp-site/generate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'image-generation', product_info: productInfo, sections }),
        })
        if (!step4Response.ok) {
          // 画像生成に失敗しても、構成とワイヤーフレームは表示済み
          console.error('画像生成に失敗しましたが、構成とワイヤーフレームは表示できます')
          setApiResult({
            product_info: productInfo,
            sections,
            wireframes,
            images: [],
            structure_json: JSON.stringify({ product_info: productInfo, sections, wireframes }, null, 2),
          })
          setApiCompleted(true)
          setProgress(100)
          setStageText('完了（一部画像は未生成）')
          setMood('happy')
          toast.warning('一部の画像生成に失敗しましたが、構成とワイヤーフレームは表示できます')
          return
        }
        const step4Data = await step4Response.json()
        images = step4Data.images

        // 最終結果を更新（画像を追加）
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
        
        setCurrentStep('complete')
        setResult(finalResult) // 結果を更新
        setApiResult(finalResult)
        setApiCompleted(true)
        setProgress(100)
        setStageText('完了！')
        setMood('happy')
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
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-slate-900">
              ドヤサイト
            </h1>
            <span className="px-2 py-1 bg-amber-500 text-white text-xs font-black rounded-md shadow-sm">
              ベータ版
            </span>
          </div>
          <p className="text-slate-600">
            商品URLまたは商品情報を入力するだけで、LP構成案・ワイヤーフレーム・画像を自動生成
          </p>
        </motion.div>

        {!result ? (
          /* Input Form */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6 md:p-8"
          >
            {/* Input Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                入力方法
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setInputType('url')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    inputType === 'url'
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  URL入力
                </button>
                <button
                  onClick={() => setInputType('form')}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    inputType === 'form'
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  フォーム入力
                </button>
              </div>
            </div>

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
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                LPタイプ
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['saas', 'ec', 'service', 'recruit'] as LpType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setLpType(type)}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                      lpType === type
                        ? 'bg-teal-500 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'saas' && 'SaaS'}
                    {type === 'ec' && 'EC'}
                    {type === 'service' && '無形サービス'}
                    {type === 'recruit' && '採用/広報'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone Selection */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                トーン
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['trust', 'pop', 'luxury', 'simple'] as Tone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                      tone === t
                        ? 'bg-teal-500 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'trust' && '信頼感'}
                    {t === 'pop' && 'ポップ'}
                    {t === 'luxury' && '高級感'}
                    {t === 'simple' && 'シンプル'}
                  </button>
                ))}
              </div>
            </div>

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

            {/* Sections */}
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
                    className="bg-white rounded-2xl shadow-lg p-6"
                  >
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-slate-900 mb-1">
                        {section.headline}
                      </h3>
                      {section.sub_headline && (
                        <p className="text-slate-600">{section.sub_headline}</p>
                      )}
                      <p className="text-sm text-slate-500 mt-2">
                        {section.purpose}
                      </p>
                    </div>

                    {hasImage ? (
                      <div className="mb-4">
                        <img
                          src={imageData}
                          alt={section.headline}
                          className="w-full rounded-xl border border-slate-200"
                        />
                      </div>
                    ) : section.image_required && (
                      <div className="mb-4 p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-bold text-gray-500">画像生成中...</p>
                          <p className="text-xs text-gray-400 mt-1">まもなく表示されます</p>
                        </div>
                      </div>
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

