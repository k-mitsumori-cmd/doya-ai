'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { LpSiteAppLayout } from '@/components/LpSiteAppLayout'
import { LpGenerationRequest, LpGenerationResult, LpType, Tone } from '@/lib/lp-site/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Download, RefreshCw, Monitor, Smartphone, Loader2, Search, Layout, Image as ImageIcon, Package, Globe, Eye, Globe2, Link2, Edit } from 'lucide-react'
import toast from 'react-hot-toast'
import { LpGenerationOverlay } from '@/components/lp-site/LpGenerationOverlay'
import { FigmaStyleEditor } from '@/components/lp-site/FigmaStyleEditor'
import { CompletionModal } from '@/components/lp-site/CompletionModal'

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
  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'sp'>('sp')
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stageText, setStageText] = useState('準備中...')
  const [mood, setMood] = useState<'idle' | 'search' | 'think' | 'happy'>('idle')
  const [apiCompleted, setApiCompleted] = useState(false)
  const [apiResult, setApiResult] = useState<LpGenerationResult | null>(null)
  const [partialResult, setPartialResult] = useState<Partial<LpGenerationResult> | null>(null)
  const [currentStep, setCurrentStep] = useState<'product' | 'structure' | 'wireframe' | 'image' | 'complete'>('product')
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0) // 経過時間を親コンポーネントで管理（リセットされないように）
  const [imageProgress, setImageProgress] = useState(0)
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({})
  const [generatingSections, setGeneratingSections] = useState<Set<string>>(new Set())
  const [combinedLpImage, setCombinedLpImage] = useState<{ pc?: string; sp?: string } | null>(null)
  const [isCombining, setIsCombining] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)

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

  // 経過時間のカウント（ワイヤーフレーム生成中のみ）
  useEffect(() => {
    if (!isGenerating) {
      // ワイヤーフレーム生成が終了したらタイマーをリセット
      setElapsedTime(0)
      return
    }
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isGenerating])

  // 進捗リセット（ワイヤーフレーム生成終了時）
  useEffect(() => {
    if (!isGenerating) {
      // ワイヤーフレーム生成が終了したら進捗をリセット
      setProgress(0)
      setStageText('準備中...')
      setMood('idle')
      setApiCompleted(false)
      setApiResult(null)
    }
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
      toast.error('URLを入力してください', { icon: '⚠️' })
      return
    }
    if (inputType === 'form' && !formData.product_name) {
      toast.error('商品名を入力してください', { icon: '⚠️' })
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
      // エラーハンドリングで参照できるように、tryブロックの外で定義
      let productInfo: any = null
      let sections: any[] = []
      let wireframes: any[] = []
      let images: any[] = []
      let competitorResearch: any = null

      try {
        // Step 1: 商品理解 (0-20%)
        setCurrentStep('product')
        updateProgress(5)
        setStageText('商品情報を分析中...')
        setMood('search')
        
        // 商品理解開始時に部分的な結果を設定（リアルタイム表示のため）
        setPartialResult({
          product_info: null, // 分析中であることを示す
        })
        
        const step1Response = await fetch('/api/lp-site/generate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'product-understanding', request_data: request }),
        })
        if (!step1Response.ok) throw new Error('商品理解に失敗しました')
        const step1Data = await step1Response.json()
        productInfo = step1Data.product_info
        competitorResearch = step1Data.competitor_research || null
        
        // 商品理解完了時に部分的な結果を更新
        setPartialResult({
          product_info: productInfo,
        })
        
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
        // LP構成生成完了後に詳細情報を表示
        setPartialResult({
          product_info: productInfo,
          sections,
        })
        updateProgress(40) // Step 2完了

        // Step 3: ワイヤーフレーム生成 (40-60%)
        setCurrentStep('wireframe')
        updateProgress(45)
        setStageText('ワイヤーフレームを生成中...')
        setMood('think')
        
        // 進捗を段階的に更新
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            // 45%から58%の間で徐々に進捗を更新
            if (prev < 58) {
              return Math.min(58, prev + 0.2)
            }
            return prev
          })
        }, 2000) // 2秒ごとに0.2%更新
        
        try {
          // 同期方式でワイヤーフレーム生成を実行
          console.log('[LP-SITE] ワイヤーフレーム生成を開始（同期方式）')
        const step3Response = await fetch('/api/lp-site/generate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'wireframe-generation', product_info: productInfo, sections }),
        })
          
          // 進捗更新をクリア
          clearInterval(progressInterval)
          
          if (!step3Response.ok) {
            const errorData = await step3Response.json().catch(() => ({}))
            const errorMessage = errorData.error || errorData.details || 'ワイヤーフレーム生成に失敗しました'
            console.error('[LP-SITE] ワイヤーフレーム生成APIエラー:', errorData)
            throw new Error(errorMessage)
          }
          
        const step3Data = await step3Response.json()
          wireframes = step3Data.wireframes || []
          
          // ワイヤーフレームが生成されていない場合（空配列）はエラー
          if (wireframes.length === 0) {
            throw new Error('ワイヤーフレームが生成されませんでした')
          }
          
          // 一部のセクションでワイヤーフレームが生成されなかった場合は警告
          if (wireframes.length < sections.length) {
            console.warn(`[LP-SITE] ワイヤーフレーム生成が一部不完全です（${wireframes.length}/${sections.length}セクション）`)
          }
          
          console.log(`[LP-SITE] ワイヤーフレーム生成完了: ${wireframes.length}セクション`)
        updateProgress(60) // Step 3完了
          setStageText('ワイヤーフレーム生成完了！')
        } catch (error: any) {
          // エラー時もクリア
          clearInterval(progressInterval)
          
          // エラーをそのままスロー（デフォルトで続行しない）
          console.error('[LP-SITE] ワイヤーフレーム生成エラー:', error)
          throw error
        }

        // ワイヤーフレームが生成されたら、すぐに結果を表示（オーバーレイを閉じて操作可能にする）
        const wireframeResult: LpGenerationResult = {
          product_info: productInfo,
          sections,
          wireframes,
          images: [],
          structure_json: JSON.stringify({ product_info: productInfo, sections, wireframes }, null, 2),
          competitor_research: competitorResearch, // 競合調査データを含める
        }
        setPartialResult(wireframeResult)
        setResult(wireframeResult)
        
        // ワイヤーフレーム生成完了：オーバーレイを完全に閉じる
        setIsGenerating(false)
        setProgress(0) // 進捗をリセット
        setStageText('準備中...')
        setMood('idle')
        toast.success('ワイヤーフレームが生成されました！画像を自動生成中...', {
          duration: 5000,
          icon: '✅',
        })

        // Step 4: 画像生成（バックグラウンドで実行、セクションごとに個別生成）
        // オーバーレイは開かず、バックグラウンドで静かに実行
        // 注意: isGeneratingImagesはtrueにするが、オーバーレイは表示しない
        console.log('[LP-SITE] 画像生成をバックグラウンドで開始します...')
        setImageProgress(0)
        setSectionProgress({})
        const initialGeneratingSections = new Set(sections.filter(s => s.image_required).map(s => s.section_id))
        setGeneratingSections(initialGeneratingSections)
        // isGeneratingImagesはオーバーレイ表示に使わず、エディタ内の進捗表示にのみ使用
        setIsGeneratingImages(true)
        
        // 画像生成を非同期で実行（セクションごとに個別生成）
        // 即座に実行されるように、awaitなしで呼び出す
        const imageGenerationPromise = (async () => {
          try {
            console.log('[LP-SITE] 画像生成非同期処理を開始します')
            setCurrentStep('image')
            setImageProgress(0)
            // 進捗は更新しない（オーバーレイが閉じているため）
            console.log('[LP-SITE] 画像生成の状態を設定しました')
            
            // 画像生成が開始されたことを確認
            if (!isGeneratingImages) {
              console.warn('[LP-SITE] 警告: isGeneratingImagesがfalseです。再設定します。')
              setIsGeneratingImages(true)
            }
            
            // すべてのセクションのエントリを最初に作成（確実に全セクションを含めるため）
            const generatedImages: SectionImage[] = sections.map(s => ({
              section_id: s.section_id,
              image_pc: undefined,
              image_sp: undefined,
            }))
            
            const imageRequiredSections = sections.filter(s => s.image_required)
            const totalSections = imageRequiredSections.length
            let completedSections = 0
            
            // 各セクションごとに画像を生成（タイムアウト付き）
            const SECTION_TIMEOUT = 240000 // 240秒（4分）- API側のmaxDuration(300秒)より短く設定
            const MAX_RETRIES = 4 // 最大4回まで再試行（合計5回試行）
            
            for (let index = 0; index < imageRequiredSections.length; index++) {
              // 各セクションの処理をtry-catchで包んで、エラーが発生しても次のセクションに進む
              try {
                const section = imageRequiredSections[index]
                const sectionId = section.section_id
                const sectionName = section.headline || section.section_type || `セクション ${index + 1}`
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:318',message:'セクション画像生成開始',data:{sectionId,index:index+1,total:imageRequiredSections.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                // #endregion
                
                let sectionImage: SectionImage | null = null
                let retryCount = 0
                let success = false
                
                // 再試行ループ
              while (retryCount <= MAX_RETRIES && !success) {
                try {
                  // セクション生成開始
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:333',message:'セクション進捗更新開始',data:{sectionId,retryCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                  // #endregion
                  setSectionProgress(prev => ({ ...prev, [sectionId]: 0 }))
                  if (retryCount > 0) {
                    // バックグラウンド実行中は、トースト通知のみ（オーバーレイは開かない）
                    toast.info(`${sectionName} の画像を再生成中... (${retryCount + 1}回目)`, {
                      duration: 3000,
                      icon: '🔄',
                    })
              } else {
                    // 最初の試行時のみ、静かに進捗を通知
                    if (index === 0) {
                      toast.info(`画像を生成中... (${index + 1}/${totalSections})`, {
                        duration: 2000,
                        icon: '🖼️',
                      })
                    }
                  }
                  
                  // AbortControllerでタイムアウトを制御
                  const abortController = new AbortController()
                  const timeoutId = setTimeout(() => {
                    abortController.abort()
                  }, SECTION_TIMEOUT)
                  
                  try {
                    const fetchPromise = fetch('/api/lp-site/regenerate-section', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        section,
                        product_info: productInfo,
                        regenerate_type: 'both', // PC/SP両方生成
                      }),
                      signal: abortController.signal,
                    })
                    
                    const sectionResponse = await fetchPromise
                    clearTimeout(timeoutId)
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:362',message:'APIレスポンス受信',data:{sectionId,ok:sectionResponse.ok,status:sectionResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
                    // #endregion
                    
                    if (!sectionResponse.ok) {
                      let errorData: any = {}
                      try {
                        errorData = await sectionResponse.json()
                      } catch {
                        // JSON解析に失敗した場合は空オブジェクトを使用
                      }
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:372',message:'APIエラー検出',data:{sectionId,status:sectionResponse.status,error:errorData.error||'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
                      // #endregion
                      console.error(`[LP-SITE] セクション画像生成エラー (${sectionId}):`, errorData)
                      
                      // タイムアウトエラーの場合、特別なメッセージを表示
                      if (sectionResponse.status === 504 || errorData.timeout) {
                        throw new Error(`タイムアウト: ${errorData.details || '画像生成に時間がかかりすぎています。再試行してください。'}`)
                      }
                      
                      const errorMsg = errorData.error || errorData.details || '画像生成に失敗しました'
                      throw new Error(errorMsg)
                    }
                    
                    const sectionData = await sectionResponse.json()
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:383',message:'画像データ受信',data:{sectionId,hasPc:!!sectionData.result?.image_pc,hasSp:!!sectionData.result?.image_sp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                    // #endregion
                    sectionImage = {
                      section_id: sectionId,
                      image_pc: sectionData.result?.image_pc,
                      image_sp: sectionData.result?.image_sp,
                    }
                    
                    // PC/SPの少なくともどちらかが生成されているか確認
                    if (sectionImage.image_pc || sectionImage.image_sp) {
                      success = true
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:393',message:'画像生成成功',data:{sectionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                      // #endregion
                    } else {
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:395',message:'画像生成失敗（空）',data:{sectionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
                      // #endregion
                      throw new Error('画像が生成されませんでした（PC/SP両方とも空）')
                    }
                  } catch (fetchError: any) {
                    clearTimeout(timeoutId)
                    if (fetchError.name === 'AbortError') {
                      throw new Error('タイムアウト: 画像生成に時間がかかりすぎています（240秒）。再試行してください。')
                    }
                    throw fetchError
                  }
                  
                } catch (error: any) {
                  console.error(`[LP-SITE] セクション画像生成エラー (${sectionId}, 試行 ${retryCount + 1}):`, error)
                  
                  retryCount++
                  
                  if (retryCount > MAX_RETRIES) {
                    // 最大再試行回数に達した場合は、空の画像として扱い処理を続行
                    console.warn(`[LP-SITE] セクション画像生成失敗（最大再試行回数に達しました）: ${sectionId}。空の画像として処理を続行します。`)
                    toast.error(`${sectionName} の画像生成に失敗しましたが、処理を続行します（後で再生成可能）`, {
                      duration: 5000,
                      icon: '⚠️',
                      style: {
                        background: '#fbbf24',
                        color: '#fff',
                      },
                    })
                    // エントリは作成するが、画像は空（後で再生成可能）
                    sectionImage = {
                      section_id: sectionId,
                      image_pc: undefined,
                      image_sp: undefined,
                    }
                    // エラーとして扱わず、処理を続行
                    break
                  } else {
                    // 再試行する前に少し待機（試行回数に応じて待機時間を増やす）
                    const waitTime = 3000 + (retryCount * 1000) // 3秒, 4秒, 5秒, 6秒...
                    console.log(`[LP-SITE] ${waitTime/1000}秒待機してから再試行します (${sectionId})`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                  }
                }
              }
              
              // 画像が生成された場合のみ完了としてカウント
              if (sectionImage && (sectionImage.image_pc || sectionImage.image_sp)) {
                // 既存のエントリを更新
                const existingIndex = generatedImages.findIndex(img => img.section_id === sectionId)
                if (existingIndex >= 0) {
                  generatedImages[existingIndex] = sectionImage
                } else {
                  generatedImages.push(sectionImage)
                }
                completedSections++
                
                // 進捗を更新
                const overallProgress = 65 + Math.round((completedSections / totalSections) * 30) // 65-95%
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:448',message:'進捗更新',data:{sectionId,completedSections,totalSections,overallProgress,imageProgress:Math.round((completedSections / totalSections) * 100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                // #endregion
                updateProgress(overallProgress)
                setImageProgress(Math.round((completedSections / totalSections) * 100))
                setSectionProgress(prev => ({ ...prev, [sectionId]: 100 }))
                
                // 個別セクション完了の通知（最後のセクションのみ、または10個ごと）
                if (completedSections === totalSections || completedSections % 10 === 0) {
                  toast.success(`${sectionName} の画像生成が完了しました (${completedSections}/${totalSections})`, {
                    duration: 2000,
                    icon: '✅',
                  })
                }
              } else {
                // 画像が生成されなかった場合
                const existingIndex = generatedImages.findIndex(img => img.section_id === sectionId)
                if (existingIndex >= 0) {
                  generatedImages[existingIndex] = sectionImage || {
                    section_id: sectionId,
                    image_pc: undefined,
                    image_sp: undefined,
                  }
                } else {
                  generatedImages.push(sectionImage || {
                    section_id: sectionId,
                    image_pc: undefined,
                    image_sp: undefined,
                  })
                }
                // 進捗は更新するが、completedSectionsは増やさない
                setSectionProgress(prev => ({ ...prev, [sectionId]: 0 }))
              }
              
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
                competitor_research: competitorResearch,
              }
              
              setResult(partialResult) // リアルタイムで結果を更新
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:508',message:'結果更新とgeneratingSections更新',data:{sectionId,imagesCount:currentImages.length,generatingSectionsBefore:Array.from(generatingSections)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
              // #endregion
              setGeneratingSections(prev => {
                const next = new Set(prev)
                next.delete(sectionId)
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/15de686c-5b2c-46c4-b310-69b34571ae07',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:512',message:'generatingSections更新後',data:{sectionId,remaining:Array.from(next)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                // #endregion
                return next
              })
              
              if (success) {
                console.log(`[LP-SITE] セクション画像生成完了: ${sectionId} (${completedSections}/${totalSections})`)
              }
              } catch (sectionError: any) {
                // セクション全体の処理で予期しないエラーが発生した場合でも続行
                const failedSection = imageRequiredSections[index]
                const failedSectionId = failedSection?.section_id || `unknown-${index}`
                console.error(`[LP-SITE] セクション処理で予期しないエラー (${failedSectionId}):`, sectionError)
                
                // 空のエントリを追加して続行
                const failedImage: SectionImage = {
                  section_id: failedSectionId,
                  image_pc: undefined,
                  image_sp: undefined,
                }
                const existingIndex = generatedImages.findIndex(img => img.section_id === failedSectionId)
                if (existingIndex >= 0) {
                  generatedImages[existingIndex] = failedImage
                } else {
                  generatedImages.push(failedImage)
                }
                
                // 結果を更新
                const currentImages = [...generatedImages]
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
                  competitor_research: competitorResearch,
                }
                setResult(partialResult)
                setGeneratingSections(prev => {
                  const next = new Set(prev)
                  next.delete(failedSectionId)
                  return next
                })
                
                // エラーをログに記録するが、処理は続行
                toast.error(`セクション ${index + 1} の処理でエラーが発生しましたが、続行します`, {
                  duration: 4000,
                  icon: '⚠️',
                })
              }
            }
            
            // すべてのセクションが確実に含まれることを確認（念のため）
            sections.forEach(s => {
              if (!generatedImages.find(img => img.section_id === s.section_id)) {
                generatedImages.push({
                  section_id: s.section_id,
                  image_pc: undefined,
                  image_sp: undefined,
                })
              }
            })
            
            // セクションの順序を維持
            const orderedImages: SectionImage[] = sections.map(s => {
              const img = generatedImages.find(i => i.section_id === s.section_id)
              return img || { section_id: s.section_id, image_pc: undefined, image_sp: undefined }
            })
            
            images = orderedImages
            
            // 最終チェック：画像が必要なセクションが全て画像を持っているか確認
            // PC/SPの少なくともどちらかが生成されている必要がある
            const finalCheck = imageRequiredSections.every(section => {
              const img = orderedImages.find(i => i.section_id === section.section_id)
              return img && (img.image_pc || img.image_sp)
            })
            
            if (!finalCheck) {
              const stillFailed = imageRequiredSections.filter(section => {
                const img = orderedImages.find(i => i.section_id === section.section_id)
                return !img || (!img.image_pc && !img.image_sp)
              })
              
              console.warn(`[LP-SITE] ${stillFailed.length} セクションの画像生成が完了していません:`, stillFailed.map(s => s.section_id))
              
              // 自動再生成を試みる（最大2回）
              const AUTO_RETRY_COUNT = 2
              let retryAttempt = 0
              let retrySuccess = false
              
              while (retryAttempt < AUTO_RETRY_COUNT && stillFailed.length > 0) {
                retryAttempt++
                console.log(`[LP-SITE] 未生成画像の自動再生成を開始 (試行 ${retryAttempt}/${AUTO_RETRY_COUNT})`)
                toast.info(`未生成画像を自動再生成中... (${retryAttempt}/${AUTO_RETRY_COUNT})`, {
                  duration: 3000,
                  icon: '🔄',
                })
                
                for (const failedSection of stillFailed) {
                  try {
                    setGeneratingSections(prev => new Set([...prev, failedSection.section_id]))
                    setSectionProgress(prev => ({ ...prev, [failedSection.section_id]: 0 }))
                    
                    const retryResponse = await fetch('/api/lp-site/regenerate-section', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        section: failedSection,
                        product_info: productInfo,
                        regenerate_type: 'both',
                      }),
                    })
                    
                    if (retryResponse.ok) {
                      const retryData = await retryResponse.json()
                      if (retryData.result?.image_pc || retryData.result?.image_sp) {
                        // 成功した画像を更新
                        const existingIndex = orderedImages.findIndex(img => img.section_id === failedSection.section_id)
                        if (existingIndex >= 0) {
                          orderedImages[existingIndex] = {
                            section_id: failedSection.section_id,
                            image_pc: retryData.result?.image_pc || orderedImages[existingIndex].image_pc,
                            image_sp: retryData.result?.image_sp || orderedImages[existingIndex].image_sp,
                          }
                        }
                        console.log(`[LP-SITE] 自動再生成成功: ${failedSection.section_id}`)
                        retrySuccess = true
                      }
                    }
                    
                    setSectionProgress(prev => ({ ...prev, [failedSection.section_id]: 100 }))
                    setGeneratingSections(prev => {
                      const next = new Set(prev)
                      next.delete(failedSection.section_id)
                      return next
                    })
                    
                    // 結果をリアルタイムで更新
                    const currentImages = [...orderedImages]
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
                      competitor_research: competitorResearch,
                    }
                    setResult(partialResult)
                  } catch (retryError: any) {
                    console.error(`[LP-SITE] 自動再生成エラー (${failedSection.section_id}):`, retryError)
                    setGeneratingSections(prev => {
                      const next = new Set(prev)
                      next.delete(failedSection.section_id)
                      return next
                    })
                  }
                }
                
                // 再チェック
                const stillFailedAfterRetry = imageRequiredSections.filter(section => {
                  const img = orderedImages.find(i => i.section_id === section.section_id)
                  return !img || (!img.image_pc && !img.image_sp)
                })
                
                if (stillFailedAfterRetry.length === 0) {
                  console.log('[LP-SITE] 自動再生成で全ての画像が生成されました')
                  break
                } else {
                  // 次の再試行のために更新
                  stillFailed.length = 0
                  stillFailed.push(...stillFailedAfterRetry)
                }
              }
              
              // 最終チェック
              const finalFailedCount = imageRequiredSections.filter(section => {
                const img = orderedImages.find(i => i.section_id === section.section_id)
                return !img || (!img.image_pc && !img.image_sp)
              }).length
              
              if (finalFailedCount > 0) {
                toast.error(`${finalFailedCount} セクションの画像生成に失敗しましたが、処理を続行します。後で再生成できます。`, {
                  duration: 6000,
                  icon: '⚠️',
                  style: {
                    background: '#fbbf24',
                    color: '#fff',
                  },
                })
              } else if (retrySuccess) {
                toast.success('🎉 自動再生成で全ての画像が生成されました！', {
                  duration: 4000,
                  icon: '✅',
                })
              }
              
              // 完了処理
              setIsGeneratingImages(false)
            setImageProgress(100)
              setStageText(finalFailedCount > 0 ? '完了（一部画像未生成）' : '完了！')
              setSectionProgress({})
              setGeneratingSections(new Set())
              
              // 最終結果を更新
              const finalResult: LpGenerationResult = {
                product_info: productInfo,
                sections,
                wireframes,
                images: orderedImages,
                structure_json: JSON.stringify({
                  product_info: productInfo,
                  sections,
                  wireframes,
                  images: orderedImages.map(img => ({
                    section_id: img.section_id,
                    has_pc: !!img.image_pc,
                    has_sp: !!img.image_sp,
                  })),
                }, null, 2),
                competitor_research: competitorResearch,
              }
              
              setResult(finalResult)
              
              // 完了モーダルを表示
              setTimeout(() => {
                setShowCompletionModal(true)
              }, 500)
              return
            }
            
            // 全ての画像生成が成功した場合のみ完了処理
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
              images: orderedImages,
              structure_json: JSON.stringify({
                product_info: productInfo,
                sections,
                wireframes,
                images: orderedImages.map(img => ({
                  section_id: img.section_id,
                  has_pc: !!img.image_pc,
                  has_sp: !!img.image_sp,
                })),
              }, null, 2),
              competitor_research: competitorResearch,
            }
            
            setResult(finalResult) // 結果を更新（画像を追加）
            setIsGeneratingImages(false)
            
            // 成功した画像数を確認（画像が必要なセクションのみ、PC/SPの少なくともどちらかが生成されている必要がある）
            const successCount = imageRequiredSections.filter(section => {
              const img = orderedImages.find(i => i.section_id === section.section_id)
              return img && (img.image_pc || img.image_sp)
            }).length
            
            // 全ての画像が必要なセクションで、少なくともPCまたはSPの画像が生成されている場合のみ完了モーダルを表示
            if (successCount === imageRequiredSections.length) {
              console.log('[LP-SITE] 全てのセクション画像生成が完了しました')
              toast.success('🎉 全ての画像生成が完了しました！', {
                duration: 3000,
                icon: '✅',
              })
              setTimeout(() => {
                setShowCompletionModal(true)
              }, 500)
            } else {
              console.error(`[LP-SITE] 画像生成が不完全です: ${successCount}/${imageRequiredSections.length}`)
              toast.success(`${successCount}/${imageRequiredSections.length} セクションの画像生成が完了しました`, {
                duration: 4000,
                icon: '✅',
                style: {
                  background: '#10b981',
                  color: '#fff',
                },
              })
            }
          } catch (error: any) {
            console.error('[LP-SITE] 画像生成エラー:', error)
            console.error('[LP-SITE] エラー詳細:', error.message, error.stack)
            
            // エラーが発生しても、可能な限り結果を返す
            setIsGeneratingImages(false)
            setImageProgress(100) // 進捗を100%にして完了状態にする
            setSectionProgress({})
            setGeneratingSections(new Set())
            
            const errorMessage = error.message || '画像生成に失敗しました'
            toast.error(`${errorMessage}。ワイヤーフレームは表示できます。後で画像を再生成してください。`, { 
              duration: 6000, 
              icon: '⚠️',
              style: {
                background: '#fbbf24',
                color: '#fff',
              },
            })
            
            // エラーが発生しても、部分的に生成された画像があれば表示
            // 画像が生成されていない場合でも、ワイヤーフレームは表示できる
            const partialResult: LpGenerationResult = {
              product_info: productInfo,
              sections,
              wireframes,
              images: images || [],
              structure_json: JSON.stringify({
                product_info: productInfo,
                sections,
                wireframes,
                images: (images || []).map(img => ({
                  section_id: img.section_id,
                  has_pc: !!img.image_pc,
                  has_sp: !!img.image_sp,
                })),
              }, null, 2),
              competitor_research: competitorResearch,
            }
            setResult(partialResult)
            
            // 進捗を完了状態にする
            updateProgress(100)
            setStageText('完了（画像未生成）')
            setMood('happy')
          }
        })()
        
        // 画像生成のPromiseをcatchしてエラーハンドリング
        imageGenerationPromise.catch((error: any) => {
          console.error('[LP-SITE] 画像生成Promiseエラー:', error)
          setIsGeneratingImages(false)
          setImageProgress(100)
          setSectionProgress({})
          setGeneratingSections(new Set())
          toast.error(`画像生成でエラーが発生しました: ${error.message || '不明なエラー'}`, {
            duration: 6000,
            icon: '⚠️',
          })
        })
      } catch (error: any) {
        console.error('[LP-SITE] 画像生成エラー:', error)
        console.error('[LP-SITE] エラー詳細:', error.message, error.stack)
        
        // エラーが発生しても、可能な限り結果を返す
        setIsGeneratingImages(false)
        setImageProgress(100) // 進捗を100%にして完了状態にする
        setSectionProgress({})
        setGeneratingSections(new Set())
        
        const errorMessage = error.message || '画像生成に失敗しました'
        toast.error(`${errorMessage}。ワイヤーフレームは表示できます。後で画像を再生成してください。`, { 
          duration: 6000, 
          icon: '⚠️',
          style: {
            background: '#fbbf24',
            color: '#fff',
          },
        })
        
        // エラーが発生しても、ワイヤーフレームは表示できる
        if (sections.length > 0) {
          const partialResult: LpGenerationResult = {
            product_info: productInfo,
            sections,
            wireframes,
            images: [],
            structure_json: JSON.stringify({ product_info: productInfo, sections, wireframes }, null, 2),
            competitor_research: competitorResearch,
          }
          setResult(partialResult)
          
          // 進捗を完了状態にする
          updateProgress(100)
          setStageText('完了（画像未生成）')
          setMood('happy')
        }
      }
    } catch (error: any) {
      console.error('[LP-SITE] 生成エラー:', error)
      console.error('[LP-SITE] エラー詳細:', error.message, error.stack)
      
      // エラーが発生しても、可能な限り結果を返す
      setIsGenerating(false)
      setIsGeneratingImages(false)
      setApiCompleted(false)
      setApiResult(null)
      
      // 部分的に生成された結果があれば表示
      if (partialResult && (partialResult.sections?.length || 0) > 0) {
        const errorResult: LpGenerationResult = {
          product_info: partialResult.product_info || productInfo,
          sections: partialResult.sections || sections || [],
          wireframes: partialResult.wireframes || wireframes || [],
          images: partialResult.images || [],
          structure_json: JSON.stringify({
            product_info: partialResult.product_info || productInfo,
            sections: partialResult.sections || sections || [],
            wireframes: partialResult.wireframes || wireframes || [],
            images: (partialResult.images || []).map(img => ({
              section_id: img.section_id,
              has_pc: !!img.image_pc,
              has_sp: !!img.image_sp,
            })),
          }, null, 2),
          competitor_research: partialResult.competitor_research || competitorResearch,
        }
        setResult(errorResult)
        setPartialResult(null)
        
        // 進捗を完了状態にする
        setProgress(100)
        setImageProgress(100)
        setStageText('完了（一部エラーあり）')
        setMood('happy')
        setSectionProgress({})
        setGeneratingSections(new Set())
        
        toast.error('一部の処理でエラーが発生しましたが、完了した部分は表示できます。', { 
          duration: 6000, 
          icon: '⚠️',
          style: {
            background: '#fbbf24',
            color: '#fff',
          },
        })
      } else {
        // 結果がない場合は、状態をリセット
        setPartialResult(null)
      setProgress(0)
        setImageProgress(0)
        setSectionProgress({})
        setGeneratingSections(new Set())
        setCurrentStep('product')
        setStageText('準備中...')
        setMood('idle')
        
        // エラーメッセージを詳細に表示
        let errorMessage = error.message || '生成に失敗しました'
        if (error.response?.status) {
          errorMessage = `HTTP ${error.response.status}: ${errorMessage}`
        }
        toast.error(errorMessage, { duration: Infinity, icon: '❌' })
      }
    }
  }

  const handleRegenerateSection = async (sectionId: string, type: 'image_pc' | 'image_sp' | 'both') => {
    if (!result) return

    // セクションを取得
      const section = result.sections.find(s => s.section_id === sectionId)
    if (!section) {
      toast.error('セクションが見つかりません', { icon: '❌' })
      return
    }

    const sectionName = section.headline || section.section_type || 'このセクション'
    const deviceName = type === 'both' ? 'PC/SP両方' : type === 'image_pc' ? 'PC' : 'SP'
    const toastId = `regenerate-${sectionId}-${type}`

    try {
      toast.loading(`${sectionName} の画像を再生成中... (${deviceName})`, {
        id: toastId,
        duration: Infinity,
      })

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
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.error || errorData.details || '再生成に失敗しました'
        throw new Error(errorMsg)
      }

      const data = await response.json()
      
      // 結果を更新（現在のresultをベースに更新）
      const updatedImages = result.images.map(img => {
        if (img.section_id === sectionId) {
          return {
            ...img,
            image_pc: type === 'both' || type === 'image_pc' ? (data.result?.image_pc || img.image_pc) : img.image_pc,
            image_sp: type === 'both' || type === 'image_sp' ? (data.result?.image_sp || img.image_sp) : img.image_sp,
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
              image_pc: data.result?.image_pc,
              image_sp: data.result?.image_sp,
            },
          ]

      setResult({
        ...result,
        images: finalImages,
      })

      toast.success(`${sectionName} の画像再生成が完了しました (${deviceName})`, {
        id: toastId,
        duration: 4000,
        icon: '✅',
      })
    } catch (error: any) {
      console.error(`[LP-SITE] 再生成エラー (${sectionId}):`, error)
      toast.error(`${sectionName} の再生成に失敗しました: ${error.message || 'エラーが発生しました'}`, {
        id: toastId,
        duration: Infinity,
        icon: '❌',
      })
      throw error // エラーを再スローして、呼び出し側で状態リセットを確実に実行
    }
  }

  const handleDownload = async (type: 'single' | 'section' | 'all_pc' | 'all_sp' | 'all_both', sectionId?: string, imageData?: string) => {
    if (!result) return

    try {
      // all_bothの場合は、PC画像とSP画像を両方ダウンロード
      if (type === 'all_both') {
        // PC画像をダウンロード
        const pcResponse = await fetch('/api/lp-site/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download_type: 'all_pc',
            all_data: result,
          }),
        })
        if (pcResponse.ok) {
          const pcBlob = await pcResponse.blob()
          const pcUrl = window.URL.createObjectURL(pcBlob)
          const pcA = document.createElement('a')
          pcA.href = pcUrl
          pcA.download = 'lp-pc-all.zip'
          document.body.appendChild(pcA)
          pcA.click()
          document.body.removeChild(pcA)
          window.URL.revokeObjectURL(pcUrl)
        }

        // SP画像をダウンロード
        const spResponse = await fetch('/api/lp-site/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download_type: 'all_sp',
            all_data: result,
          }),
        })
        if (spResponse.ok) {
          const spBlob = await spResponse.blob()
          const spUrl = window.URL.createObjectURL(spBlob)
          const spA = document.createElement('a')
          spA.href = spUrl
          spA.download = 'lp-sp-all.zip'
          document.body.appendChild(spA)
          spA.click()
          document.body.removeChild(spA)
          window.URL.revokeObjectURL(spUrl)
        }

        toast.success('PC画像とSP画像をダウンロードしました')
        return
      }

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
      toast.error(error.message || 'ダウンロードに失敗しました', { duration: Infinity, icon: '❌' })
    }
  }

  // 未生成画像の自動再生成
  const handleAutoRegenerate = async (sectionIds: string[]) => {
    if (!result || sectionIds.length === 0) return

    console.log(`[LP-SITE] 自動再生成開始: ${sectionIds.length}セクション`)
    setIsGeneratingImages(true)
    setGeneratingSections(new Set(sectionIds))

    const toastId = 'auto-regenerate'
    toast.loading(`${sectionIds.length}セクションの画像を自動再生成中...`, {
      id: toastId,
      duration: Infinity,
    })

    let successCount = 0
    let failCount = 0

    for (const sectionId of sectionIds) {
      const section = result.sections.find(s => s.section_id === sectionId)
      if (!section) continue

      const sectionName = section.headline || section.section_type || `セクション`

      try {
        setSectionProgress(prev => ({ ...prev, [sectionId]: 0 }))

        const response = await fetch('/api/lp-site/regenerate-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section,
            product_info: result.product_info,
            regenerate_type: 'both',
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || '再生成に失敗しました')
        }

        const data = await response.json()

        // 結果を更新
        setResult(prev => {
          if (!prev) return prev
          const updatedImages = prev.images.map(img => {
            if (img.section_id === sectionId) {
              return {
                ...img,
                image_pc: data.result?.image_pc || img.image_pc,
                image_sp: data.result?.image_sp || img.image_sp,
              }
            }
            return img
          })

          // 画像がまだない場合は新規追加
          const hasExistingImage = prev.images.some(img => img.section_id === sectionId)
          const finalImages = hasExistingImage
            ? updatedImages
            : [
                ...prev.images,
                {
                  section_id: sectionId,
                  image_pc: data.result?.image_pc,
                  image_sp: data.result?.image_sp,
                },
              ]

          return {
            ...prev,
            images: finalImages,
          }
        })

        setSectionProgress(prev => ({ ...prev, [sectionId]: 100 }))
        setGeneratingSections(prev => {
          const next = new Set(prev)
          next.delete(sectionId)
          return next
        })

        successCount++
        console.log(`[LP-SITE] 自動再生成完了: ${sectionName} (${successCount}/${sectionIds.length})`)
      } catch (error: any) {
        console.error(`[LP-SITE] 自動再生成エラー (${sectionId}):`, error)
        failCount++
        setGeneratingSections(prev => {
          const next = new Set(prev)
          next.delete(sectionId)
          return next
        })
      }
    }

    setIsGeneratingImages(false)
    setSectionProgress({})
    setGeneratingSections(new Set())

    if (failCount === 0) {
      toast.success(`🎉 ${successCount}セクションの画像を再生成しました！`, {
        id: toastId,
        duration: 4000,
        icon: '✅',
      })
    } else {
      toast.error(`${successCount}セクション成功、${failCount}セクション失敗`, {
        id: toastId,
        duration: 6000,
        icon: '⚠️',
      })
    }
  }

  // 結果がある場合はフルスクリーンのFigma風エディタを表示
  if (result) {
    return (
      <>
        {/* 生成中オーバーレイ（ワイヤーフレーム生成中のみ表示、画像生成中は非表示） */}
        <LpGenerationOverlay
          open={isGenerating}
          progress={progress}
          stageText={stageText}
          mood={mood}
          steps={steps}
          allowBackgroundView={true}
          productInfo={partialResult?.product_info}
          sections={partialResult?.sections}
          currentStep={currentStep}
          elapsedTime={elapsedTime}
        />
        {result && (
          <CompletionModal
            open={showCompletionModal}
            onClose={() => setShowCompletionModal(false)}
            result={result}
          />
        )}
        <FigmaStyleEditor
          result={result}
          selectedDevice={selectedDevice}
          onDeviceChange={setSelectedDevice}
          isGeneratingImages={isGeneratingImages}
          sectionProgress={sectionProgress}
          generatingSections={generatingSections}
          onAutoRegenerate={handleAutoRegenerate}
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
          onSectionDelete={(sectionId) => {
            setResult({
              ...result,
              sections: result.sections.filter((s) => s.section_id !== sectionId),
              images: result.images.filter((img) => img.section_id !== sectionId),
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
              toast.error(error.message || 'プレビューの作成に失敗しました', { duration: Infinity, icon: '❌' })
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
              toast.error(error.message || '公開に失敗しました', { duration: Infinity, icon: '❌' })
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
      {/* 生成中オーバーレイ（ワイヤーフレーム生成中のみ表示） */}
            <LpGenerationOverlay
              open={isGenerating}
              progress={progress}
              stageText={stageText}
              mood={mood}
              steps={steps}
        allowBackgroundView={false}
        productInfo={partialResult?.product_info}
        sections={partialResult?.sections}
        currentStep={currentStep}
        elapsedTime={elapsedTime}
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

            {/* LP Type Selection - 詳細設定（プルダウン） */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="mb-6"
            >
              <details className="group">
                <summary className="cursor-pointer list-none">
              <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Layout className="w-4 h-4 text-teal-600" />
                    LPタイプ（詳細設定）
                    <span className="ml-auto text-xs text-slate-500 font-normal">
                      {lpType === 'saas' && 'SaaS'}
                      {lpType === 'ec' && 'EC'}
                      {lpType === 'service' && '無形サービス'}
                      {lpType === 'recruit' && '採用/広報'}
                      {lpType === 'education' && '教育'}
                      {lpType === 'beauty' && '美容'}
                      {lpType === 'healthcare' && '医療'}
                      {lpType === 'finance' && '金融'}
                    </span>
              </label>
                </summary>
                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-600 mb-3">
                    基本はURLから自動判定されますが、詳細設定で変更できます
                  </p>
                  <select
                    value={lpType}
                    onChange={(e) => setLpType(e.target.value as LpType)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-700 font-medium"
                  >
                    <option value="saas">SaaS</option>
                    <option value="ec">EC</option>
                    <option value="service">無形サービス</option>
                    <option value="recruit">採用/広報</option>
                    <option value="education">教育</option>
                    <option value="beauty">美容</option>
                    <option value="healthcare">医療</option>
                    <option value="finance">金融</option>
                  </select>
              </div>
              </details>
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

