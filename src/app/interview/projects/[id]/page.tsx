'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, Sparkles, CheckCircle, Clock, Download, Zap, Loader2, ArrowRight, Settings, RefreshCw, MessageSquare, FileEdit, Users, Briefcase, Edit, Save, X, FileDown, FileCode, FileType, AlertCircle, Table2, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { InterviewCompletionModal } from '@/components/InterviewCompletionModal'
import { TableInsertModal } from '@/components/TableInsertModal'
import { ImageInsertModal } from '@/components/ImageInsertModal'

type ArticleType = 'INTERVIEW' | 'BUSINESS_REPORT' | 'INTERNAL_INTERVIEW' | 'CASE_STUDY'
type DisplayFormat = 'QA' | 'MONOLOGUE'

export default function InterviewProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'transcription' | 'draft' | 'review'>('draft')
  const [showArticleTypeSelector, setShowArticleTypeSelector] = useState(false)
  const [selectedArticleType, setSelectedArticleType] = useState<ArticleType>('INTERVIEW')
  const [selectedDisplayFormat, setSelectedDisplayFormat] = useState<DisplayFormat>('QA')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [showExportMenu, setShowExportMenu] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showTableInsertModal, setShowTableInsertModal] = useState(false)
  const [showImageInsertModal, setShowImageInsertModal] = useState(false)

  const fetchProject = async () => {
    try {
      setError(null)
      
      // ゲストIDを取得
      let guestId = null
      if (typeof window !== 'undefined') {
        try {
          guestId = localStorage.getItem('interview-guest-id')
        } catch (storageError) {
          console.warn('Failed to get guest ID from localStorage:', storageError)
          // localStorageエラーでも続行
        }
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (guestId) {
        headers['x-guest-id'] = guestId
      }
      
      const res = await fetch(`/api/interview/projects/${projectId}`, {
        headers,
      })
      
      if (!res.ok) {
        let errorData: any = {}
        try {
          errorData = await res.json()
        } catch {
          // JSONパースエラーでも続行
        }
        const errorMessage = errorData.error || `HTTP error! status: ${res.status}`
        
        if (res.status === 401) {
          throw new Error('認証が必要です。ログインしてください。')
        } else if (res.status === 404) {
          throw new Error('プロジェクトが見つかりません。')
        } else {
          throw new Error(errorMessage)
        }
      }
      
      let data: any = {}
      try {
        data = await res.json()
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error('サーバーからの応答を解析できませんでした')
      }
      
      if (!data || !data.project) {
        throw new Error('プロジェクトデータが取得できませんでした')
      }
      
      // プロジェクトデータの検証とデフォルト値の設定
      const projectData = {
        ...data.project,
        title: data.project.title || '無題のプロジェクト',
        status: data.project.status || 'UNKNOWN',
        materials: Array.isArray(data.project.materials) ? data.project.materials : [],
        transcriptions: Array.isArray(data.project.transcriptions) ? data.project.transcriptions : [],
        drafts: Array.isArray(data.project.drafts) ? data.project.drafts : [],
        reviews: Array.isArray(data.project.reviews) ? data.project.reviews : [],
      }
      
      setProject(projectData)
    } catch (error) {
      console.error('Failed to fetch project:', error)
      const errorMessage = error instanceof Error ? error.message : 'プロジェクトの取得に失敗しました'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const handleGenerateArticle = async (articleType?: ArticleType, displayFormat?: DisplayFormat) => {
    if (!project) return

    const finalArticleType = articleType || selectedArticleType
    const finalDisplayFormat = displayFormat || selectedDisplayFormat

    setProcessing(true)
    try {
      // ゲストIDを取得
      let guestId = null
      if (typeof window !== 'undefined') {
        try {
          guestId = localStorage.getItem('interview-guest-id')
        } catch (storageError) {
          console.warn('Failed to get guest ID from localStorage:', storageError)
        }
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (guestId) {
        headers['x-guest-id'] = guestId
      }

      // プロジェクトを最新の状態に更新
      await fetchProject()
      
      // 最新のプロジェクトデータを取得
      let currentProject = project
      let transcriptions = currentProject.transcriptions || []
      
      // 文字起こしが存在しない場合
      if (transcriptions.length === 0) {
        throw new Error('文字起こしが存在しません。先にファイルをアップロードして文字起こしを実行してください。')
      }

      // 処理中の文字起こしを確認（PROCESSING または PENDING）
      const processingTranscriptions = transcriptions.filter((t: any) => 
        t.status === 'PROCESSING' || t.status === 'PENDING'
      )
      
      if (processingTranscriptions.length > 0) {
        // ファイルサイズに応じた待機時間を計算
        // 全ての文字起こしが完了するまで待機するための動的待機時間を計算
        const calculateMaxWaitTime = (material: any): number => {
          if (!material || !material.fileSize) {
            // ファイルサイズが不明な場合はデフォルト値（30分）
            return 30 * 60 // 30分（秒）
          }
          
          const fileSizeMB = Number(material.fileSize) / (1024 * 1024)
          const fileSizeGB = fileSizeMB / 1024
          const materialType = material.type || 'audio'
          
          let estimatedSeconds = 0
          
          if (materialType === 'video') {
            // 動画ファイルの場合: 音声抽出時間 + 文字起こし時間
            // 音声長の推定: 1GB ≈ 1時間（一般的な1080p動画）
            const audioLengthMinutes = fileSizeGB * 60
            // 音声抽出時間: 1分の動画 ≈ 約4秒（FFmpeg処理、より現実的な値）
            const extractionTime = audioLengthMinutes * 4
            // 文字起こし時間: 音声長の20%（リアルタイムファクター、より現実的な値）
            const transcriptionTime = audioLengthMinutes * 60 * 0.2
            estimatedSeconds = extractionTime + transcriptionTime
          } else {
            // 音声ファイルの場合: 文字起こし時間のみ
            // 音声長の推定: MP3 (128kbps) 1MB ≈ 約1.08分
            const audioLengthMinutes = fileSizeMB * 1.08
            // 文字起こし時間: 音声長の20%（リアルタイムファクター、より現実的な値）
            const transcriptionTime = audioLengthMinutes * 60 * 0.2
            estimatedSeconds = transcriptionTime
          }
          
          // バッファ時間を追加（処理時間の50%、最低10分）
          const bufferTime = Math.max(10 * 60, estimatedSeconds * 0.5)
          const totalSeconds = estimatedSeconds + bufferTime
          
          // 最小待機時間: 5分、最大待機時間: 3日（72時間）
          // 10GB動画ファイル: 約34時間、10GB音声ファイル: 約72時間かかるため
          const minWaitTime = 5 * 60 // 5分
          const maxWaitTime = 3 * 24 * 60 * 60 // 3日（72時間）
          
          return Math.max(minWaitTime, Math.min(maxWaitTime, totalSeconds))
        }
        
        // 最大待機時間を計算（すべての処理中の文字起こしの最大値）
        let maxWaitTimeSeconds = 0
        for (const transcription of processingTranscriptions) {
          // 文字起こしに関連する素材を取得
          const material = currentProject.materials?.find((m: any) => m.id === transcription.materialId)
          const waitTime = calculateMaxWaitTime(material)
          maxWaitTimeSeconds = Math.max(maxWaitTimeSeconds, waitTime)
        }
        
        // 待機間隔: ファイルサイズに応じて調整（大きいファイルは長めの間隔）
        // 1時間以上: 5秒、6時間以上: 10秒、24時間以上: 30秒
        let waitInterval = 2000 // デフォルト2秒
        if (maxWaitTimeSeconds >= 24 * 60 * 60) {
          waitInterval = 30000 // 24時間以上なら30秒
        } else if (maxWaitTimeSeconds >= 6 * 60 * 60) {
          waitInterval = 10000 // 6時間以上なら10秒
        } else if (maxWaitTimeSeconds >= 60 * 60) {
          waitInterval = 5000 // 1時間以上なら5秒
        }
        const maxRetries = Math.ceil(maxWaitTimeSeconds / (waitInterval / 1000))
        
        console.log(`[INTERVIEW] Transcription wait time calculated:`, {
          maxWaitTimeMinutes: (maxWaitTimeSeconds / 60).toFixed(1),
          maxWaitTimeHours: (maxWaitTimeSeconds / 3600).toFixed(2),
          waitInterval,
          maxRetries,
        })
        
        // 文字起こしが処理中の場合は完了を待機
        const maxWaitMinutes = Math.ceil(maxWaitTimeSeconds / 60)
        const maxWaitHours = Math.floor(maxWaitMinutes / 60)
        const remainingMinutes = maxWaitMinutes % 60
        const waitTimeDisplay = maxWaitHours > 0 
          ? `${maxWaitHours}時間${remainingMinutes > 0 ? `${remainingMinutes}分` : ''}`
          : `${maxWaitMinutes}分`
        setProcessingStep(`文字起こしが完了するのを待機中...（最大${waitTimeDisplay}）`)
        
        for (const transcription of processingTranscriptions) {
          let retryCount = 0
          let completed = false
          const startTime = Date.now()
          
          while (retryCount < maxRetries && !completed) {
            await new Promise(resolve => setTimeout(resolve, waitInterval))
            
            // 経過時間を計算
            const elapsedSeconds = (Date.now() - startTime) / 1000
            const remainingSeconds = maxWaitTimeSeconds - elapsedSeconds
            
            if (remainingSeconds > 0) {
              const remainingMinutes = Math.ceil(remainingSeconds / 60)
              const remainingHours = Math.floor(remainingMinutes / 60)
              const remainingMins = remainingMinutes % 60
              const remainingDisplay = remainingHours > 0
                ? `${remainingHours}時間${remainingMins > 0 ? `${remainingMins}分` : ''}`
                : `${remainingMinutes}分`
              setProcessingStep(`文字起こしが完了するのを待機中...（残り約${remainingDisplay}）`)
            }
            
            try {
              const statusRes = await fetch(`/api/interview/transcribe/status/${transcription.id}`, {
                headers: guestId ? { 'x-guest-id': guestId } : {},
              })
              
              if (statusRes.ok) {
                const statusData = await statusRes.json()
                const status = statusData.status
                
                if (status === 'COMPLETED' && statusData.text && statusData.text.trim().length > 0) {
                  completed = true
                  // プロジェクトを再取得して最新の状態を取得
                  await fetchProject()
                  // 最新のプロジェクトデータを更新
                  const res = await fetch(`/api/interview/projects/${projectId}`, {
                    headers: guestId ? { 'x-guest-id': guestId } : {},
                  })
                  if (res.ok) {
                    const data = await res.json()
                    if (data.project) {
                      currentProject = data.project
                      transcriptions = currentProject.transcriptions || []
                    }
                  }
                  break
                } else if (status === 'ERROR') {
                  throw new Error(`文字起こし処理でエラーが発生しました: ${statusData.text || 'Unknown error'}`)
                }
                // PROCESSINGの場合は継続
              }
            } catch (checkError) {
              console.warn('Failed to check transcription status:', checkError)
            }
            
            retryCount++
          }
          
          if (!completed) {
            const material = currentProject.materials?.find((m: any) => m.id === transcription.materialId)
            const fileSizeGB = material?.fileSize ? (Number(material.fileSize) / (1024 * 1024 * 1024)).toFixed(2) : '不明'
            throw new Error(
              `文字起こし処理がタイムアウトしました（最大待機時間: ${Math.ceil(maxWaitTimeSeconds / 60)}分）。\n` +
              `ファイルサイズ: ${fileSizeGB}GB\n` +
              `大きなファイルの場合は処理に時間がかかります。しばらく待ってから再度お試しください。`
            )
          }
        }
        
        // 待機後に再度プロジェクトを取得
        await fetchProject()
        const res = await fetch(`/api/interview/projects/${projectId}`, {
          headers: guestId ? { 'x-guest-id': guestId } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (data.project) {
            currentProject = data.project
            transcriptions = currentProject.transcriptions || []
          }
        }
      }
      
      // 全ての文字起こしが完了するまで待機（再確認）
      // プロジェクトを再取得して最新の状態を確認
      await fetchProject()
      let finalCheckRes = await fetch(`/api/interview/projects/${projectId}`, {
        headers: guestId ? { 'x-guest-id': guestId } : {},
      })
      if (finalCheckRes.ok) {
        const finalCheckData = await finalCheckRes.json()
        if (finalCheckData.project) {
          currentProject = finalCheckData.project
          transcriptions = currentProject.transcriptions || []
        }
      }

      // 全ての文字起こしを確認
      const allTranscriptions = transcriptions || []
      const stillProcessing = allTranscriptions.filter((t: any) => 
        t.status === 'PROCESSING' || t.status === 'PENDING'
      )
      
      // 処理中の文字起こしがまだある場合は、全て完了するまで待機
      if (stillProcessing.length > 0) {
        console.log('[INTERVIEW] Processing transcriptions found, waiting for all to complete:', {
          projectId,
          processingCount: stillProcessing.length,
          processingIds: stillProcessing.map((t: any) => t.id),
        })
        
        setProcessingStep(`全ての文字起こしが完了するのを待機中...（残り${stillProcessing.length}件）`)
        
        // 全ての処理中の文字起こしが完了するまで待機
        const maxWaitTimeSeconds = 3 * 24 * 60 * 60 // 最大3日
        const waitInterval = 5000 // 5秒間隔
        const maxRetries = Math.ceil(maxWaitTimeSeconds / (waitInterval / 1000))
        const startTime = Date.now()
        
        // 全ての処理中の文字起こしが完了するまでループ
        let allCompleted = false
        let totalWaitCount = 0
        
        while (!allCompleted && totalWaitCount < maxRetries) {
          // プロジェクトを再取得して最新の状態を確認
          await fetchProject()
          const statusCheckRes = await fetch(`/api/interview/projects/${projectId}`, {
            headers: guestId ? { 'x-guest-id': guestId } : {},
          })
          if (statusCheckRes.ok) {
            const statusCheckData = await statusCheckRes.json()
            if (statusCheckData.project) {
              currentProject = statusCheckData.project
              transcriptions = currentProject.transcriptions || []
            }
          }
          
          // 現在の処理中の文字起こしを確認
          const currentProcessing = transcriptions.filter((t: any) => 
            t.status === 'PROCESSING' || t.status === 'PENDING'
          )
          
          console.log('[INTERVIEW] Checking transcription status:', {
            projectId,
            waitCount: totalWaitCount,
            stillProcessingCount: currentProcessing.length,
            processingIds: currentProcessing.map((t: any) => t.id),
            allTranscriptionCount: transcriptions.length,
          })
          
          // 処理中の文字起こしがなくなったら完了
          if (currentProcessing.length === 0) {
            allCompleted = true
            console.log('[INTERVIEW] All transcriptions completed:', {
              projectId,
              totalWaitCount,
              totalTranscriptionCount: transcriptions.length,
            })
            break
          }
          
          // 残り件数を更新
          setProcessingStep(`全ての文字起こしが完了するのを待機中...（残り${currentProcessing.length}件）`)
          
          // 各処理中の文字起こしの状態を確認
          for (const transcription of currentProcessing) {
            try {
              const statusRes = await fetch(`/api/interview/transcribe/status/${transcription.id}`, {
                headers: guestId ? { 'x-guest-id': guestId } : {},
              })
              
              if (statusRes.ok) {
                const statusData = await statusRes.json()
                const status = statusData.status
                
                if (status === 'COMPLETED' && statusData.text && statusData.text.trim().length > 0) {
                  console.log('[INTERVIEW] Transcription completed:', {
                    transcriptionId: transcription.id,
                    textLength: statusData.text.length,
                  })
                } else if (status === 'ERROR') {
                  console.error('[INTERVIEW] Transcription error:', {
                    transcriptionId: transcription.id,
                    error: statusData.text || 'Unknown error',
                  })
                  throw new Error(`文字起こし処理でエラーが発生しました: ${statusData.text || 'Unknown error'}`)
                }
              }
            } catch (checkError) {
              console.warn('[INTERVIEW] Failed to check transcription status:', {
                transcriptionId: transcription.id,
                error: checkError,
              })
            }
          }
          
          // 待機
          await new Promise(resolve => setTimeout(resolve, waitInterval))
          
          // 経過時間を計算して表示
          const elapsedSeconds = (Date.now() - startTime) / 1000
          const remainingSeconds = maxWaitTimeSeconds - elapsedSeconds
          
          if (remainingSeconds > 0) {
            const remainingMinutes = Math.ceil(remainingSeconds / 60)
            const remainingHours = Math.floor(remainingMinutes / 60)
            const remainingMins = remainingMinutes % 60
            const remainingDisplay = remainingHours > 0
              ? `${remainingHours}時間${remainingMins > 0 ? `${remainingMins}分` : ''}`
              : `${remainingMinutes}分`
            setProcessingStep(`全ての文字起こしが完了するのを待機中...（残り${currentProcessing.length}件、残り約${remainingDisplay}）`)
          }
          
          totalWaitCount++
        }
        
        if (!allCompleted) {
          throw new Error('文字起こし処理がタイムアウトしました。しばらく待ってから再度お試しください。')
        }
        
        // 全ての文字起こしが完了したら、再度プロジェクトを取得
        await fetchProject()
        finalCheckRes = await fetch(`/api/interview/projects/${projectId}`, {
          headers: guestId ? { 'x-guest-id': guestId } : {},
        })
        if (finalCheckRes.ok) {
          const finalCheckData = await finalCheckRes.json()
          if (finalCheckData.project) {
            currentProject = finalCheckData.project
            transcriptions = currentProject.transcriptions || []
          }
        }
      }

      // 全ての文字起こしが完了していることを確認
      const allTranscriptionsFinal = transcriptions || []
      const allCompletedTranscriptions = allTranscriptionsFinal.filter((t: any) => {
        const hasText = t.text && typeof t.text === 'string' && t.text.trim().length > 0
        const isCompleted = t.status === 'COMPLETED'
        return isCompleted && hasText
      })
      
      // 処理中の文字起こしがまだある場合はエラー
      const stillProcessingFinal = allTranscriptionsFinal.filter((t: any) => 
        t.status === 'PROCESSING' || t.status === 'PENDING'
      )
      
      if (stillProcessingFinal.length > 0) {
        throw new Error(`まだ処理中の文字起こしが${stillProcessingFinal.length}件あります。全て完了するまでお待ちください。`)
      }
      
      // 文字起こしが1件もない場合
      if (allTranscriptionsFinal.length === 0) {
        throw new Error('文字起こしが存在しません。先にファイルをアップロードして文字起こしを実行してください。')
      }
      
      // 完了した文字起こしがない場合
      if (allCompletedTranscriptions.length === 0) {
        const hasError = allTranscriptionsFinal.some((t: any) => t.status === 'ERROR')
        const hasCompletedButNoText = allTranscriptionsFinal.some((t: any) => 
          t.status === 'COMPLETED' && (!t.text || t.text.trim().length === 0)
        )
        
        if (hasError) {
          throw new Error('文字起こし処理でエラーが発生しました。ファイルを再アップロードしてください。')
        } else if (hasCompletedButNoText) {
          throw new Error('文字起こしは完了しましたが、テキストが取得できませんでした。しばらく待ってから再度お試しください。')
        } else {
          throw new Error('文字起こしが完了していません。文字起こしを先に実行してください。')
        }
      }

      // 全ての文字起こしが完了していることを確認（全ての文字起こしが完了している必要がある）
      if (allCompletedTranscriptions.length !== allTranscriptionsFinal.length) {
        const notCompleted = allTranscriptionsFinal.filter((t: any) => 
          t.status !== 'COMPLETED' || !t.text || t.text.trim().length === 0
        )
        throw new Error(
          `全ての文字起こしが完了していません。\n` +
          `完了: ${allCompletedTranscriptions.length}件 / 全体: ${allTranscriptionsFinal.length}件\n` +
          `未完了: ${notCompleted.length}件（${notCompleted.map((t: any) => t.status).join(', ')}）`
        )
      }

      // 文字起こしテキストの内容を確認（全ての文字起こしテキストを結合）
      const allTranscriptionText = allCompletedTranscriptions
        .map((t: any) => t.text)
        .join('\n\n')
      
      if (!allTranscriptionText || allTranscriptionText.trim().length === 0) {
        throw new Error('文字起こしテキストが空です。文字起こしを再実行してください。')
      }

      // 文字起こしが完全に終了していることを確認（最低限の文字数があることを確認）
      const minTextLength = 10 // 最低10文字以上
      if (allTranscriptionText.trim().length < minTextLength) {
        throw new Error(`文字起こしテキストが短すぎます（${allTranscriptionText.trim().length}文字）。文字起こしが正しく完了していない可能性があります。`)
      }

      console.log('[INTERVIEW] ========== All transcriptions verified before outline generation ==========')
      console.log('[INTERVIEW] Project ID:', projectId)
      console.log('[INTERVIEW] Total transcription count:', allTranscriptionsFinal.length)
      console.log('[INTERVIEW] Completed transcription count:', allCompletedTranscriptions.length)
      console.log('[INTERVIEW] Total text length:', allTranscriptionText.length)
      console.log('[INTERVIEW] Completed transcription IDs:', allCompletedTranscriptions.map((t: any) => t.id))
      console.log('[INTERVIEW] All transcription statuses:', allTranscriptionsFinal.map((t: any) => ({
        id: t.id,
        status: t.status,
        hasText: !!(t.text && t.text.trim().length > 0),
        textLength: t.text?.length || 0,
        materialId: t.materialId,
      })))
      console.log('[INTERVIEW] ========================================================================')

      // 1. 構成案生成（文字起こしが完全に終了したことを確認してから実行）
      if (!project.outline) {
        console.log('[INTERVIEW] Starting outline generation check:', {
          projectId,
          hasOutline: !!project.outline,
        })
        
        // 構成案生成を呼び出す前に、再度プロジェクトを取得して最新の状態を確認
        await fetchProject()
        const preOutlineCheckRes = await fetch(`/api/interview/projects/${projectId}`, {
          headers: guestId ? { 'x-guest-id': guestId } : {},
        })
        
        console.log('[INTERVIEW] Pre-outline check response:', {
          projectId,
          ok: preOutlineCheckRes.ok,
          status: preOutlineCheckRes.status,
        })
        
        if (preOutlineCheckRes.ok) {
          const preOutlineCheckData = await preOutlineCheckRes.json()
          console.log('[INTERVIEW] Pre-outline check data:', {
            projectId,
            hasProject: !!preOutlineCheckData.project,
            transcriptionCount: preOutlineCheckData.project?.transcriptions?.length || 0,
          })
          
          if (preOutlineCheckData.project) {
            currentProject = preOutlineCheckData.project
            transcriptions = currentProject.transcriptions || []
            
            // 処理中の文字起こしがまだある場合は、完了するまで待機
            const stillProcessingBeforeOutline = transcriptions.filter((t: any) => 
              t.status === 'PROCESSING' || t.status === 'PENDING'
            )
            
            console.log('[INTERVIEW] Transcription status check before outline:', {
              projectId,
              totalTranscriptions: transcriptions.length,
              processingCount: stillProcessingBeforeOutline.length,
              processingIds: stillProcessingBeforeOutline.map((t: any) => t.id),
              allStatuses: transcriptions.map((t: any) => ({ id: t.id, status: t.status })),
            })
            
            if (stillProcessingBeforeOutline.length > 0) {
              console.log('[INTERVIEW] Still processing transcriptions found before outline generation, waiting:', {
                projectId,
                processingCount: stillProcessingBeforeOutline.length,
                processingIds: stillProcessingBeforeOutline.map((t: any) => t.id),
              })
              
              setProcessingStep(`文字起こしの完了を待機中...（残り${stillProcessingBeforeOutline.length}件）`)
              
              // 全ての処理中の文字起こしが完了するまで待機
              const maxWaitTimeSeconds = 3 * 24 * 60 * 60 // 最大3日
              const waitInterval = 5000 // 5秒間隔
              const maxRetries = Math.ceil(maxWaitTimeSeconds / (waitInterval / 1000))
              const startTime = Date.now()
              
              let allCompletedBeforeOutline = false
              let totalWaitCountBeforeOutline = 0
              
              while (!allCompletedBeforeOutline && totalWaitCountBeforeOutline < maxRetries) {
                await fetchProject()
                const statusCheckRes = await fetch(`/api/interview/projects/${projectId}`, {
                  headers: guestId ? { 'x-guest-id': guestId } : {},
                })
                if (statusCheckRes.ok) {
                  const statusCheckData = await statusCheckRes.json()
                  if (statusCheckData.project) {
                    currentProject = statusCheckData.project
                    transcriptions = currentProject.transcriptions || []
                  }
                }
                
                const currentProcessingBeforeOutline = transcriptions.filter((t: any) => 
                  t.status === 'PROCESSING' || t.status === 'PENDING'
                )
                
                if (currentProcessingBeforeOutline.length === 0) {
                  allCompletedBeforeOutline = true
                  break
                }
                
                setProcessingStep(`文字起こしの完了を待機中...（残り${currentProcessingBeforeOutline.length}件）`)
                
                await new Promise(resolve => setTimeout(resolve, waitInterval))
                totalWaitCountBeforeOutline++
              }
              
              if (!allCompletedBeforeOutline) {
                console.error('[INTERVIEW] Transcription wait timeout before outline generation:', {
                  projectId,
                  totalWaitCount: totalWaitCountBeforeOutline,
                  maxRetries,
                })
                throw new Error('文字起こし処理がタイムアウトしました。しばらく待ってから再度お試しください。')
              }
              
              console.log('[INTERVIEW] All transcriptions completed before outline generation:', {
                projectId,
                totalWaitCount: totalWaitCountBeforeOutline,
                elapsedSeconds: (Date.now() - startTime) / 1000,
              })
              
              // 待機後に再度プロジェクトを取得
              await fetchProject()
              const finalCheckRes = await fetch(`/api/interview/projects/${projectId}`, {
                headers: guestId ? { 'x-guest-id': guestId } : {},
              })
              if (finalCheckRes.ok) {
                const finalCheckData = await finalCheckRes.json()
                if (finalCheckData.project) {
                  currentProject = finalCheckData.project
                  transcriptions = currentProject.transcriptions || []
                  
                  // 最終確認
                  const finalProcessingCheck = transcriptions.filter((t: any) => 
                    t.status === 'PROCESSING' || t.status === 'PENDING'
                  )
                  console.log('[INTERVIEW] Final transcription status check before outline:', {
                    projectId,
                    totalTranscriptions: transcriptions.length,
                    stillProcessing: finalProcessingCheck.length,
                    allStatuses: transcriptions.map((t: any) => ({ id: t.id, status: t.status })),
                  })
                  
                  if (finalProcessingCheck.length > 0) {
                    console.warn('[INTERVIEW] WARNING: Still processing transcriptions found after wait, but proceeding to outline generation:', {
                      projectId,
                      processingCount: finalProcessingCheck.length,
                      processingIds: finalProcessingCheck.map((t: any) => t.id),
                    })
                  }
                }
              }
            } else {
              console.log('[INTERVIEW] No processing transcriptions found before outline generation, proceeding:', {
                projectId,
                totalTranscriptions: transcriptions.length,
                allStatuses: transcriptions.map((t: any) => ({ id: t.id, status: t.status })),
              })
            }
          } else {
            console.warn('[INTERVIEW] Pre-outline check: project not found in response:', {
              projectId,
            })
          }
        } else {
          console.warn('[INTERVIEW] Pre-outline check failed:', {
            projectId,
            status: preOutlineCheckRes.status,
          })
        }
        
        setProcessingStep('構成案を生成中...')
        
        // 構成案生成をリトライ可能な形で実行
        // 処理中の文字起こしがある場合は自動的にリトライする
        // 長時間処理でもエラーを発生させずに処理を継続する
        let outlineGenerated = false
        let retryCount = 0
        const maxRetries = 100000 // 実質的に無制限（長時間処理に対応、最大3日 = 259200秒 / 5秒 = 51840回）
        const baseRetryInterval = 5000 // 基本5秒間隔
        const maxRetryInterval = 30000 // 最大30秒間隔（長時間待機時）
        
        console.log('[INTERVIEW] Starting outline generation with retry logic:', {
          projectId,
          maxRetries,
          baseRetryInterval,
          maxRetryInterval,
        })
        
        while (!outlineGenerated && retryCount < maxRetries) {
          try {
            // タイムアウト制御用のAbortController
            const abortController = new AbortController()
            const timeoutId = setTimeout(() => abortController.abort(), 60000) // 60秒タイムアウト
            
            let outlineRes: Response
            try {
              outlineRes = await fetch('/api/interview/outline', {
                method: 'POST',
                headers,
                body: JSON.stringify({ projectId }),
                signal: abortController.signal,
              })
            } finally {
              clearTimeout(timeoutId)
            }
            
            if (outlineRes.ok) {
              // 成功した場合
              outlineGenerated = true
              await fetchProject() // 再取得
              break
            }
            
            // エラーレスポンスを解析
            const errorData = await outlineRes.json().catch(() => ({}))
            const errorMessage = errorData.details || errorData.error || '構成案生成に失敗しました'
            
            // デバッグログを追加
            console.log('[INTERVIEW] Outline generation API error response:', {
              status: outlineRes.status,
              errorData,
              errorMessage,
              retryable: errorData.retryable,
              error: errorData.error,
              details: errorData.details,
            })
            
            // 処理中の文字起こしがある場合は自動的にリトライ
            // retryableフラグがある場合、またはエラーメッセージに「まだ処理中」が含まれる場合
            const isRetryable = errorData.retryable || 
                                errorData.error === 'Transcription still processing' || 
                                errorMessage.includes('まだ処理中') ||
                                errorData.error?.includes('Transcription still processing') ||
                                errorData.details?.includes('まだ処理中')
            
            console.log('[INTERVIEW] Retry check:', {
              isRetryable,
              retryable: errorData.retryable,
              error: errorData.error,
              errorMessage,
              errorMessageIncludes: errorMessage.includes('まだ処理中'),
            })
            
            if (isRetryable) {
              retryCount++
              
              // プロジェクトを再取得して最新の状態を確認
              try {
                await fetchProject()
                const checkAbortController = new AbortController()
                const checkTimeoutId = setTimeout(() => checkAbortController.abort(), 30000) // 30秒タイムアウト
                
                let checkRes: Response
                try {
                  checkRes = await fetch(`/api/interview/projects/${projectId}`, {
                    headers: guestId ? { 'x-guest-id': guestId } : {},
                    signal: checkAbortController.signal,
                  })
                } finally {
                  clearTimeout(checkTimeoutId)
                }
                
                let processingCount = 0
                let processingDetails: any[] = []
                if (checkRes.ok) {
                  const checkData = await checkRes.json()
                  const checkTranscriptions = checkData.project?.transcriptions || []
                  const processing = checkTranscriptions.filter((t: any) => 
                    t.status === 'PROCESSING' || t.status === 'PENDING'
                  )
                  processingCount = processing.length
                  
                  // 処理中の詳細情報を取得
                  processingDetails = processing.map((t: any) => {
                    const material = checkData.project?.materials?.find((m: any) => m.id === t.materialId)
                    const fileSize = material?.fileSize 
                      ? (typeof material.fileSize === 'bigint' 
                          ? Number(material.fileSize) 
                          : Number(material.fileSize)) / (1024 * 1024 * 1024)
                      : null
                    return {
                      id: t.id,
                      fileName: material?.fileName || '不明',
                      fileSize: fileSize ? `${fileSize.toFixed(2)}GB` : '不明',
                      status: t.status,
                    }
                  })
                }
                
                // 待機メッセージを更新（詳細情報を含める）
                if (processingCount > 0) {
                  const detailText = processingDetails.length > 0 
                    ? `（${processingDetails.map(d => d?.fileName || '不明').filter((name, index, arr) => arr.indexOf(name) === index).join(', ')}）`
                    : ''
                  setProcessingStep(`文字起こしの完了を待機中...（残り${processingCount}件${detailText}、${retryCount}回目の確認）`)
                } else {
                  setProcessingStep(`構成案生成を準備中...（${retryCount}回目の確認）`)
                }
                
                console.log(`[INTERVIEW] Transcription still processing, retrying outline generation (attempt ${retryCount}):`, {
                  projectId,
                  processingCount: errorData.processingCount || processingCount,
                  processingDetails: errorData.processingDetails || processingDetails,
                  retryCount,
                })
              } catch (fetchError) {
                // プロジェクト取得エラーは無視して続行（ネットワークエラーの可能性）
                console.warn('[INTERVIEW] Failed to fetch project status, continuing retry:', fetchError)
                setProcessingStep(`文字起こしの完了を待機中...（${retryCount}回目の確認、状態確認中...）`)
              }
              
              // リトライ間隔を動的に調整（長時間待機時は間隔を長くする）
              const retryInterval = retryCount > 100 
                ? Math.min(maxRetryInterval, baseRetryInterval * Math.floor(retryCount / 100))
                : baseRetryInterval
              
              // 待機してからリトライ
              await new Promise(resolve => setTimeout(resolve, retryInterval))
              continue
            }
            
            // その他のエラーの場合は、詳細を確認してからエラーを投げる
            console.error('[INTERVIEW] Outline generation failed (non-retryable error):', {
              error: errorMessage,
              errorData,
              retryCount,
            })
            
            // エラーが発生した場合、再度文字起こしの状態を確認
            try {
              await fetchProject()
              const checkAbortController = new AbortController()
              const checkTimeoutId = setTimeout(() => checkAbortController.abort(), 30000) // 30秒タイムアウト
              
              let checkRes: Response
              try {
                checkRes = await fetch(`/api/interview/projects/${projectId}`, {
                  headers: guestId ? { 'x-guest-id': guestId } : {},
                  signal: checkAbortController.signal,
                })
              } finally {
                clearTimeout(checkTimeoutId)
              }
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                const checkTranscriptions = checkData.project?.transcriptions || []
                const checkCompleted = checkTranscriptions.filter((t: any) => 
                  t.status === 'COMPLETED' && t.text && t.text.trim().length > 0
                )
                console.error('[INTERVIEW] Transcription status after outline error:', {
                  totalCount: checkTranscriptions.length,
                  completedCount: checkCompleted.length,
                  statuses: checkTranscriptions.map((t: any) => ({ id: t.id, status: t.status, hasText: !!(t.text && t.text.trim().length > 0) })),
                })
              }
            } catch (checkError) {
              console.warn('[INTERVIEW] Failed to check transcription status after error:', checkError)
            }
            
            throw new Error(errorMessage)
          } catch (fetchError: any) {
            // ネットワークエラーやタイムアウトエラーの場合もリトライ
            if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError' || fetchError.message?.includes('timeout')) {
              retryCount++
              console.warn(`[INTERVIEW] Network/timeout error during outline generation, retrying (attempt ${retryCount}):`, fetchError)
              setProcessingStep(`構成案生成を試行中...（ネットワークエラー、${retryCount}回目のリトライ）`)
              
              // ネットワークエラーの場合は少し長めに待機
              await new Promise(resolve => setTimeout(resolve, baseRetryInterval * 2))
              continue
            }
            
            // その他のエラーは再スロー
            throw fetchError
          }
        }
        
        // 最大リトライ回数に達した場合（通常は発生しない）
        if (!outlineGenerated) {
          console.error('[INTERVIEW] Outline generation reached max retries:', {
            projectId,
            retryCount,
            maxRetries,
          })
          throw new Error('構成案生成のリトライ回数が上限に達しました。しばらく待ってから再度お試しください。')
        }
      }

      // 2. 記事生成
      setProcessingStep('記事を生成中...')
      
      const draftRes = await fetch('/api/interview/draft', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId,
          articleType: finalArticleType,
          displayFormat: finalDisplayFormat,
        }),
      })
      if (!draftRes.ok) throw new Error('記事生成に失敗しました')

      await fetchProject() // 再取得
      setActiveTab('draft')
      setShowArticleTypeSelector(false)
      setShowCompletionModal(true) // 完了モーダルを表示
    } catch (error) {
      console.error('[INTERVIEW] Failed to generate article:', error)
      const errorMessage = error instanceof Error ? error.message : '不明なエラー'
      
      // エラーメッセージを表示
      // リトライ処理は既に構成案生成APIの呼び出し部分で実装されているため、
      // "Transcription still processing"エラーの場合は、リトライ処理が動作するはず
      setError(errorMessage)
      
      // "Transcription still processing"エラーの場合は、alertを表示しない（リトライ処理が動作するため）
      // ただし、リトライ処理が既に実装されているため、ここでエラーを再スローしない
      if (!errorMessage.includes('Transcription still processing') && !errorMessage.includes('まだ処理中')) {
        alert(`エラーが発生しました: ${errorMessage}`)
        setProcessing(false)
        setProcessingStep('')
      } else {
        // リトライ可能なエラーの場合は、処理を継続（リトライ処理が動作する）
        console.log('[INTERVIEW] Retryable error caught, retry logic should handle it')
      }
    } finally {
      // エラーが発生していない場合、またはリトライ不可能なエラーの場合のみ、processingをfalseにする
      // リトライ可能なエラーの場合は、リトライ処理が動作するため、processingはtrueのまま
    }
  }

  const handleRegenerateArticle = async () => {
    setShowArticleTypeSelector(true)
  }

  const handleExport = (draft: any, format: 'markdown' | 'html' | 'txt') => {
    if (!draft) {
      console.error('Draft is null or undefined')
      return
    }

    let content = ''
    let filename = ''
    let mimeType = ''

    const draftTitle = draft.title || '無題'
    const draftLead = draft.lead || ''
    const draftContent = draft.content || ''
    const draftWordCount = draft.wordCount || 0
    const draftReadingTime = draft.readingTime || 0
    const draftVersion = draft.version || 1

    if (format === 'markdown') {
      content = `# ${draftTitle}\n\n${draftLead ? `> ${draftLead}\n\n` : ''}${draftContent}`
      filename = `${draftTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.md`
      mimeType = 'text/markdown'
    } else if (format === 'html') {
      // HTMLエスケープ関数
      const escapeHtml = (text: string) => {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
      }

      const escapedTitle = escapeHtml(draftTitle)
      const escapedLead = escapeHtml(draftLead)
      const escapedContent = (draftContent || '').split('\n').map((line: string) => {
        const escapedLine = escapeHtml(line)
        if (line.startsWith('Q:') || line.startsWith('Q：')) {
          return `<div style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border-left: 4px solid #3b82f6;"><strong style="color: #1e40af;">${escapedLine}</strong></div>`
        }
        if (line.startsWith('A:') || line.startsWith('A：')) {
          return `<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border-left: 4px solid #64748b;">${escapedLine}</div>`
        }
        return `<p>${escapedLine || '&nbsp;'}</p>`
      }).join('')

      content = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #333; }
    h1 { color: #f97316; border-bottom: 3px solid #f97316; padding-bottom: 0.5rem; }
    h2 { color: #ea580c; margin-top: 2rem; }
    blockquote { border-left: 4px solid #f97316; padding-left: 1rem; margin-left: 0; color: #666; font-style: italic; }
    p { margin: 1rem 0; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>${escapedTitle}</h1>
  <div class="meta">
    ${draftWordCount > 0 ? `文字数: ${draftWordCount.toLocaleString()}文字 | ` : ''}
    ${draftReadingTime > 0 ? `読了時間: ${draftReadingTime}分 | ` : ''}
    バージョン: ${draftVersion}
  </div>
  ${draftLead ? `<blockquote>${escapedLead}</blockquote>` : ''}
  <div>${escapedContent}</div>
</body>
</html>`
      filename = `${draftTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.html`
      mimeType = 'text/html'
    } else {
      content = `${draftTitle}\n\n${draftLead ? `${draftLead}\n\n` : ''}${draftContent}`
      filename = `${draftTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.txt`
      mimeType = 'text/plain'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(null)
  }

  const handleStartEdit = (draft: any) => {
    setEditingDraftId(draft.id)
    setEditedContent(draft.content)
  }

  const handleSaveEdit = async (draftId: string) => {
    try {
      const res = await fetch(`/api/interview/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      })
      if (res.ok) {
        await fetchProject()
        setEditingDraftId(null)
        setEditedContent('')
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(`保存に失敗しました: ${errorData.error || '不明なエラー'}`)
      }
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('保存に失敗しました')
    }
  }

  const handleCancelEdit = () => {
    setEditingDraftId(null)
    setEditedContent('')
  }

  const handleInsertTable = (tableMarkdown: string) => {
    if (!editingDraftId) return
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = editedContent.substring(0, start)
    const after = editedContent.substring(end)
    const newContent = before + '\n\n' + tableMarkdown + '\n\n' + after
    setEditedContent(newContent)
    
    // カーソル位置を調整
    setTimeout(() => {
      textarea.focus()
      const newPos = start + tableMarkdown.length + 4
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const handleInsertImage = (imageMarkdown: string) => {
    if (!editingDraftId) return
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = editedContent.substring(0, start)
    const after = editedContent.substring(end)
    const newContent = before + '\n\n' + imageMarkdown + '\n\n' + after
    setEditedContent(newContent)
    
    // カーソル位置を調整
    setTimeout(() => {
      textarea.focus()
      const newPos = start + imageMarkdown.length + 4
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // エクスポートメニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showExportMenu && !(e.target as Element).closest('.export-menu-container')) {
        setShowExportMenu(null)
      }
    }
    if (showExportMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showExportMenu])

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-orange-100 mb-6">
            <AlertCircle className="w-12 h-12 text-orange-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">エラーが発生しました</h2>
          <p className="text-slate-600 mb-6">
            {error || 'プロジェクトが見つかりません'}
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <motion.button
            onClick={() => {
              setError(null)
              setLoading(true)
              fetchProject()
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            再試行する
          </motion.button>
          <Link
            href="/interview/projects"
            className="px-6 py-3 bg-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-300 transition-all inline-flex items-center gap-2"
          >
            <ArrowRight className="w-5 h-5 rotate-180" />
            プロジェクト一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-8">
        <Link href="/interview/projects" className="text-sm text-slate-600 hover:text-orange-600 mb-4 inline-block">
          ← プロジェクト一覧に戻る
        </Link>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mb-2 break-words">{project.title || '無題のプロジェクト'}</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
          <span className="px-2 sm:px-3 py-1 bg-slate-100 rounded-lg font-bold inline-block w-fit">{project.status || '不明'}</span>
          {project.intervieweeName && <span className="break-words">対象者: {project.intervieweeName}</span>}
          <span>更新: {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('ja-JP') : '日付不明'}</span>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'draft', label: '記事', icon: Sparkles },
          { id: 'overview', label: '概要', icon: FileText },
          { id: 'materials', label: '素材', icon: Upload },
          { id: 'transcription', label: '文字起こし', icon: FileText },
          { id: 'review', label: '校閲', icon: CheckCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-2 sm:px-4 py-2 font-bold text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 記事タイプ選択モーダル */}
      <AnimatePresence>
        {showArticleTypeSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowArticleTypeSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4"
            >
              <div className="p-4 sm:p-6 md:p-8">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mb-2">記事タイプを選択</h2>
                <p className="text-sm sm:text-base text-slate-600 mb-4 sm:mb-6 md:mb-8">記事の形式と表示スタイルを選択してください</p>

                {/* 記事タイプ選択 */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FileEdit className="w-5 h-5" />
                    記事タイプ
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { type: 'INTERVIEW' as ArticleType, label: 'インタビュー記事', icon: MessageSquare, desc: '質問と回答の形式で構成' },
                      { type: 'BUSINESS_REPORT' as ArticleType, label: '商談レポート', icon: Briefcase, desc: '商談内容を報告書形式で' },
                      { type: 'INTERNAL_INTERVIEW' as ArticleType, label: '社内インタビュー', icon: Users, desc: '社内メンバーへのインタビュー' },
                      { type: 'CASE_STUDY' as ArticleType, label: '事例取材記事', icon: FileText, desc: '使用感などの事例としてまとめる' },
                    ].map((item) => (
                      <motion.button
                        key={item.type}
                        onClick={() => setSelectedArticleType(item.type)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all text-left ${
                          selectedArticleType === item.type
                            ? 'border-orange-500 bg-orange-50 shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <item.icon className={`w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3 ${selectedArticleType === item.type ? 'text-orange-600' : 'text-slate-400'}`} />
                        <h4 className="text-sm sm:text-base font-black text-slate-900 mb-1">{item.label}</h4>
                        <p className="text-xs sm:text-sm text-slate-600">{item.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* 表示形式選択 */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    表示形式
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { format: 'QA' as DisplayFormat, label: 'Q&A形式', desc: '質問と回答を明確に分けて表示' },
                      { format: 'MONOLOGUE' as DisplayFormat, label: '一人で喋っている形式', desc: '回答者の発言を自然な文章として連続表示' },
                    ].map((item) => (
                      <motion.button
                        key={item.format}
                        onClick={() => setSelectedDisplayFormat(item.format)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-6 rounded-2xl border-2 transition-all text-left ${
                          selectedDisplayFormat === item.format
                            ? 'border-purple-500 bg-purple-50 shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <h4 className="font-black text-slate-900 mb-1">{item.label}</h4>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-4 justify-end">
                  <button
                    onClick={() => setShowArticleTypeSelector(false)}
                    className="px-6 py-3 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <motion.button
                    onClick={() => handleGenerateArticle()}
                    disabled={processing}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {processingStep}
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        記事を生成する
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* アクションボタン（素材がある場合） */}
      {project.materials && Array.isArray(project.materials) && project.materials.length > 0 && 
       project.transcriptions && Array.isArray(project.transcriptions) && project.transcriptions.length > 0 && 
       (!project.drafts || !Array.isArray(project.drafts) || project.drafts.length === 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-8 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-3xl border-2 border-orange-200 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-orange-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                記事を生成しましょう
              </h3>
              <p className="text-orange-700 font-medium">
                文字起こしが完了しました。記事タイプと表示形式を選択して記事を生成します
              </p>
            </div>
            <motion.button
              onClick={() => setShowArticleTypeSelector(true)}
              disabled={processing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {processingStep}
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  記事を生成する
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* コンテンツ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-2">基本情報</h3>
              <dl className="space-y-2">
                {project.genre && (
                  <div>
                    <dt className="text-sm font-bold text-slate-600">インタビュージャンル</dt>
                    <dd className="text-slate-900">
                      {project.genre === 'CASE_STUDY' && '事例のインタビュー'}
                      {project.genre === 'PRODUCT_INTERVIEW' && '商品インタビュー'}
                      {project.genre === 'PERSONA_INTERVIEW' && 'ペルソナインタビュー'}
                      {project.genre === 'OTHER' && 'その他'}
                      {project.genre && !['CASE_STUDY', 'PRODUCT_INTERVIEW', 'PERSONA_INTERVIEW', 'OTHER'].includes(project.genre) && project.genre}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-bold text-slate-600">インタビュー対象者</dt>
                  <dd className="text-slate-900">{project.intervieweeName || '未設定'}</dd>
                </div>
                {project.intervieweeRole && (
                  <div>
                    <dt className="text-sm font-bold text-slate-600">役職・職業</dt>
                    <dd className="text-slate-900">{project.intervieweeRole || '未設定'}</dd>
                  </div>
                )}
                {project.intervieweeCompany && (
                  <div>
                    <dt className="text-sm font-bold text-slate-600">所属企業</dt>
                    <dd className="text-slate-900">{project.intervieweeCompany || '未設定'}</dd>
                  </div>
                )}
              </dl>
            </div>
            {project.theme && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">取材テーマ</h3>
                <p className="text-slate-700">{project.theme || ''}</p>
              </div>
            )}
            {project.purpose && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">目的</h3>
                <p className="text-slate-700">{project.purpose || ''}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'materials' && (
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">アップロード済み素材</h3>
            <div className="space-y-4">
              {project.materials && Array.isArray(project.materials) && project.materials.length > 0 ? (
                project.materials.map((material: any) => (
                  <div key={material?.id || Math.random()} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{material?.fileName || 'ファイル名不明'}</p>
                        <p className="text-sm text-slate-600">
                          {material?.type || 'タイプ不明'} • {material?.fileSize ? `${(Number(material.fileSize) / 1024 / 1024).toFixed(2)} MB` : 'サイズ不明'}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                        {material?.status || '不明'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-600">素材がアップロードされていません</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transcription' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">文字起こし</h3>
              {project.transcriptions && Array.isArray(project.transcriptions) && project.transcriptions.length > 0 && 
               (!project.drafts || !Array.isArray(project.drafts) || project.drafts.length === 0) && (
                <motion.button
                  onClick={() => setShowArticleTypeSelector(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  記事を生成する
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
            {project.transcriptions && Array.isArray(project.transcriptions) && project.transcriptions.length > 0 ? (
              <div className="space-y-6">
                {project.transcriptions.map((transcription: any) => {
                  if (!transcription || !transcription.id) return null
                  return (
                    <motion.div
                      key={transcription.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-8 bg-gradient-to-br from-white to-slate-50 rounded-3xl border-2 border-slate-200 shadow-xl"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black rounded-full">
                            {transcription.provider || 'manual'}
                          </span>
                          <span className="text-sm text-slate-600 font-medium">
                            {(transcription.text || '').length.toLocaleString()}文字
                          </span>
                        </div>
                      </div>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-base">
                          {transcription.text || ''}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg font-medium">文字起こしがありません</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'draft' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">記事</h3>
              {project.drafts && Array.isArray(project.drafts) && project.drafts.length > 0 && 
               project.transcriptions && Array.isArray(project.transcriptions) && project.transcriptions.length > 0 && (
                <motion.button
                  onClick={handleRegenerateArticle}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  別の形式で再生成
                </motion.button>
              )}
            </div>
            {project.drafts && Array.isArray(project.drafts) && project.drafts.length > 0 ? (
              <div className="space-y-6">
                {project.drafts.map((draft: any) => {
                  if (!draft || !draft.id) return null
                  
                  const articleTypeLabels: Record<string, string> = {
                    INTERVIEW: 'インタビュー記事',
                    BUSINESS_REPORT: '商談レポート',
                    INTERNAL_INTERVIEW: '社内インタビュー',
                    CASE_STUDY: '事例取材記事',
                  }
                  const displayFormatLabels: Record<string, string> = {
                    QA: 'Q&A形式',
                    MONOLOGUE: '一人で喋っている形式',
                  }

                  return (
                    <motion.div
                      key={draft.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-8 bg-gradient-to-br from-white to-slate-50 rounded-3xl border-2 border-slate-200 shadow-xl"
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 break-words">{draft.title || '無題'}</h4>
                            {draft.articleType && (
                              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-black rounded-full">
                                {articleTypeLabels[draft.articleType] || draft.articleType}
                              </span>
                            )}
                            {draft.displayFormat && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-black rounded-full">
                                {displayFormatLabels[draft.displayFormat] || draft.displayFormat}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                              <FileText className="w-4 h-4 text-slate-600" />
                              <span className="font-black text-slate-700">バージョン {draft.version || 1}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                              <span className="font-black text-blue-700">{(draft.wordCount || 0).toLocaleString()}</span>
                              <span className="text-blue-600">文字</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                              <Clock className="w-4 h-4 text-purple-600" />
                              <span className="font-black text-purple-700">{draft.readingTime || 0}</span>
                              <span className="text-purple-600">分</span>
                            </div>
                            {draft.wordCount && typeof draft.wordCount === 'number' && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                <span className="text-emerald-600 text-xs">読みやすさ</span>
                                <span className="font-black text-emerald-700">
                                  {Math.min(100, Math.round((draft.wordCount / 2000) * 100))}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 relative">
                          {editingDraftId === draft.id ? (
                            <>
                              <motion.button
                                onClick={() => handleSaveEdit(draft.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all inline-flex items-center gap-2"
                              >
                                <Save className="w-4 h-4" />
                                保存
                              </motion.button>
                              <motion.button
                                onClick={handleCancelEdit}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2.5 bg-slate-500 text-white font-black rounded-xl hover:bg-slate-600 transition-all inline-flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                キャンセル
                              </motion.button>
                            </>
                          ) : (
                            <>
                              <motion.button
                                onClick={() => handleStartEdit(draft)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all inline-flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                編集
                              </motion.button>
                              <div className="relative export-menu-container">
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowExportMenu(showExportMenu === draft.id ? null : draft.id)
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  エクスポート
                                </motion.button>
                                {showExportMenu === draft.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-slate-200 py-2 z-50 min-w-[200px]"
                                  >
                                    <button
                                      onClick={() => handleExport(draft, 'markdown')}
                                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                      <FileCode className="w-5 h-5 text-purple-500" />
                                      <span className="font-bold text-slate-900">Markdown</span>
                                    </button>
                                    <button
                                      onClick={() => handleExport(draft, 'html')}
                                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                      <FileType className="w-5 h-5 text-blue-500" />
                                      <span className="font-bold text-slate-900">HTML</span>
                                    </button>
                                    <button
                                      onClick={() => handleExport(draft, 'txt')}
                                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                      <FileDown className="w-5 h-5 text-slate-500" />
                                      <span className="font-bold text-slate-900">テキスト</span>
                                    </button>
                                  </motion.div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {draft.lead && (
                        <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border-l-4 border-orange-500">
                          <p className="text-lg font-bold text-slate-800 leading-relaxed">{draft.lead}</p>
                        </div>
                      )}
                      {editingDraftId === draft.id ? (
                        <div className="space-y-4">
                          {/* 編集ツールバー */}
                          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <motion.button
                              onClick={() => setShowTableInsertModal(true)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all inline-flex items-center gap-2 text-sm font-bold text-slate-700"
                              title="表を挿入"
                            >
                              <Table2 className="w-4 h-4" />
                              表を挿入
                            </motion.button>
                            <motion.button
                              onClick={() => setShowImageInsertModal(true)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all inline-flex items-center gap-2 text-sm font-bold text-slate-700"
                              title="図を挿入"
                            >
                              <ImageIcon className="w-4 h-4" />
                              図を挿入
                            </motion.button>
                          </div>
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full min-h-[400px] p-6 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 leading-relaxed text-base font-medium resize-y font-sans"
                            placeholder="記事の内容を編集..."
                          />
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="font-bold">{(editedContent || '').length.toLocaleString()}</span>文字
                            <span className="text-slate-400">|</span>
                            <span>読了時間: {Math.ceil((editedContent || '').length / 400)}分</span>
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate max-w-none" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif' }}>
                          <div 
                            className="text-slate-700 leading-relaxed text-base"
                            style={{ 
                              fontSize: '16.5px',
                              lineHeight: '2.05',
                              letterSpacing: '0.015em',
                              fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif'
                            }}
                          >
                            {(() => {
                              try {
                                const content = draft.content || ''
                                if (typeof content !== 'string') {
                                  console.warn('Draft content is not a string:', typeof content)
                                  return <p className="text-slate-500">コンテンツが読み込めませんでした</p>
                                }
                                
                                // 表の処理
                                const lines = content.split('\n')
                                const result: JSX.Element[] = []
                                let inTable = false
                                let tableLines: string[] = []
                                
                                const renderTable = (tableLines: string[]) => {
                                  const rows = tableLines
                                    .filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'))
                                    .map((l) => l.trim().slice(1, -1).split('|').map((c) => c.trim()))
                                  if (rows.length >= 2) {
                                    const head = rows[0]
                                    const body = rows.slice(2) // 2行目は区切り想定
                                    return (
                                      <div key={`table-${result.length}`} className="my-8 overflow-x-auto">
                                        <table className="w-full border-collapse bg-white rounded-xl shadow-lg border-2 border-slate-200">
                                          <thead>
                                            <tr className="bg-gradient-to-r from-blue-500 to-indigo-600">
                                              {head.map((cell, idx) => (
                                                <th key={idx} className="px-6 py-4 text-left text-white font-black text-sm border-b-2 border-blue-600">
                                                  {cell}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {body.map((row, rowIdx) => (
                                              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                {row.map((cell, cellIdx) => (
                                                  <td key={cellIdx} className="px-6 py-4 text-slate-700 font-medium text-sm border-b border-slate-200">
                                                    {cell}
                                                  </td>
                                                ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )
                                  }
                                  return null
                                }
                                
                                lines.forEach((line, idx) => {
                                  // 表の処理
                                  if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                                    if (!inTable) {
                                      inTable = true
                                      tableLines = []
                                    }
                                    tableLines.push(line)
                                    return
                                  } else {
                                    if (inTable) {
                                      result.push(renderTable(tableLines)!)
                                      inTable = false
                                      tableLines = []
                                    }
                                  }
                                  
                                  // 画像の処理
                                  const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]+)")?\)/)
                                  if (imageMatch) {
                                    const [, alt, url, title] = imageMatch
                                    result.push(
                                      <div key={idx} className="my-8">
                                        <img
                                          src={url}
                                          alt={alt || '画像'}
                                          title={title}
                                          className="w-full h-auto rounded-2xl shadow-xl border-2 border-slate-200"
                                        />
                                        {alt && (
                                          <p className="mt-3 text-center text-sm text-slate-600 font-bold italic">
                                            {alt}
                                          </p>
                                        )}
                                      </div>
                                    )
                                    return
                                  }
                                  
                                  // Q&A形式の処理
                                  if (draft.displayFormat === 'QA') {
                                    if (line.startsWith('Q:') || line.startsWith('Q：')) {
                                      result.push(
                                        <div key={idx} className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-l-4 border-blue-500 shadow-sm">
                                          <p className="font-black text-blue-900 text-lg leading-relaxed">{line}</p>
                                        </div>
                                      )
                                      return
                                    }
                                    if (line.startsWith('A:') || line.startsWith('A：')) {
                                      result.push(
                                        <div key={idx} className="mb-8 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-l-4 border-slate-400 shadow-sm">
                                          <p className="text-slate-800 leading-relaxed text-base font-medium">{line}</p>
                                        </div>
                                      )
                                      return
                                    }
                                  }
                                  
                                  // 見出しの処理
                                  const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
                                  if (headingMatch) {
                                    const level = headingMatch[1].length
                                    const text = headingMatch[2]
                                    const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
                                    const className = level === 1 
                                      ? 'text-3xl font-black text-slate-900 mt-10 mb-6 pb-3 border-b-2 border-slate-300'
                                      : level === 2
                                      ? 'text-2xl font-black text-slate-900 mt-8 mb-4 pl-3 border-l-4 border-blue-500'
                                      : 'text-xl font-black text-slate-900 mt-6 mb-3'
                                    result.push(
                                      <HeadingTag key={idx} className={className}>
                                        {text}
                                      </HeadingTag>
                                    )
                                    return
                                  }
                                  
                                  // 通常のテキスト
                                  if (line.trim()) {
                                    result.push(
                                      <p key={idx} className="mb-5 leading-relaxed text-slate-700 font-medium">
                                        {line}
                                      </p>
                                    )
                                  } else {
                                    result.push(<br key={idx} />)
                                  }
                                })
                                
                                // 最後の表を処理
                                if (inTable) {
                                  result.push(renderTable(tableLines)!)
                                }
                                
                                return result
                              } catch (e) {
                                console.error('Error rendering draft content:', e)
                                return <p className="text-red-500">コンテンツの表示中にエラーが発生しました</p>
                              }
                            })()}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg font-medium">記事がありません</p>
                {project.transcriptions && Array.isArray(project.transcriptions) && project.transcriptions.length > 0 && (
                  <motion.button
                    onClick={() => setShowArticleTypeSelector(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                  >
                    <Zap className="w-5 h-5" />
                    記事を生成する
                  </motion.button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">校閲結果</h3>
            {project.reviews && Array.isArray(project.reviews) && project.reviews.length > 0 ? (
              <div className="space-y-4">
                {project.reviews.map((review: any) => {
                  if (!review || !review.id) return null
                  return (
                    <div key={review.id} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-slate-900">校閲レポート</p>
                          <p className="text-sm text-slate-600">
                            スコア: {review.score || 'N/A'} / 読みやすさ: {review.readabilityScore || 'N/A'}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('ja-JP') : '日付不明'}
                        </span>
                      </div>
                      <div className="text-slate-700 whitespace-pre-wrap">{review.report || ''}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-600">校閲結果がありません</p>
            )}
          </div>
        )}
      </div>

      {/* 完了モーダル */}
      <InterviewCompletionModal
        open={showCompletionModal}
        title={project?.title || '記事'}
        subtitle="丁寧なビジネス記事が完成しました。内容をご確認いただけます。"
        primaryLabel="記事を確認する"
        onPrimary={() => {
          setShowCompletionModal(false)
          setActiveTab('draft')
        }}
        onClose={() => setShowCompletionModal(false)}
      />

      {/* 表挿入モーダル */}
      <TableInsertModal
        open={showTableInsertModal}
        onClose={() => setShowTableInsertModal(false)}
        onInsert={handleInsertTable}
      />

      {/* 図挿入モーダル */}
      <ImageInsertModal
        open={showImageInsertModal}
        onClose={() => setShowImageInsertModal(false)}
        onInsert={handleInsertImage}
      />
    </div>
  )
}

