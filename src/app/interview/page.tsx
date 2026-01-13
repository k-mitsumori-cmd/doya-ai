'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Video,
  Music,
  File,
  X,
  Zap,
  AlertCircle,
  Rocket,
  Wand2,
  Clock,
  Crown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PartyLoadingOverlay, type OverlayMood } from '@/components/persona/PersonaMotion'
import { getMaxFileSize, getEffectivePlan, isFileSizeWithinLimit, PLAN_LIMITS, type InterviewPlan } from '@/lib/interview/planLimits'

type UploadStatus = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'completed' | 'error'
type MaterialType = 'audio' | 'video' | 'text' | 'pdf' | null

// Google Cloud Storageを使用したアップロード
// - 文字起こし機能を使用するため、プラン別に制限が設定されています
// - チャンクアップロードを使用することで、大きなファイルもアップロード可能
// - 4.5MBを超えるファイルは自動的にチャンクアップロードを使用（Vercelのサーバーレス関数制限）
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024 // 10GB（最大値、プラン別に制限されます）
const VERCEL_LIMIT = 4.5 * 1024 * 1024 // 4.5MB（Vercelのサーバーレス関数のリクエストボディサイズ制限）
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB（チャンクサイズ - Vercelの制限より少し小さく）
const USE_CHUNK_UPLOAD = true // チャンクアップロードを有効化（4.5MB以上のファイルをアップロード可能）
const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg']
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm']
const SUPPORTED_TEXT_TYPES = ['text/plain', 'text/markdown']
const SUPPORTED_PDF_TYPES = ['application/pdf']

export default function InterviewPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [materialType, setMaterialType] = useState<MaterialType>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const isUploading = uploadStatus !== 'idle' && uploadStatus !== 'completed' && uploadStatus !== 'error'
  const [blockNavigation, setBlockNavigation] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<InterviewPlan>('GUEST')
  const [guestFirstAccessAt, setGuestFirstAccessAt] = useState<Date | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await handleFileSelect(files[0])
    }
  }, []) // handleFileSelectは安定しているので依存配列に含めない

  // アップロード中のページ遷移防止
  useEffect(() => {
    if (!isUploading) {
      setBlockNavigation(false)
      return
    }

    setBlockNavigation(true)

    // beforeunloadイベントでページ遷移を防止（タブ移動は可能）
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'アップロード中です。ブラウザを閉じるとアップロードが中断されます。別タブに切り替えることは可能です。'
      return e.returnValue
    }

    // ルーター遷移を防止するためのカスタムイベント
    const handleRouteChange = (e: PopStateEvent) => {
      if (isUploading) {
        e.preventDefault()
        if (window.confirm('アップロード中です。ページを離れるとアップロードが中断されます。\n\n別タブに切り替えることは可能です。\n\n本当にページを離れますか？')) {
          setBlockNavigation(false)
          window.history.back()
        } else {
          window.history.pushState(null, '', window.location.href)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handleRouteChange)

    // history.pushStateを監視して遷移を防止
    const originalPushState = window.history.pushState
    window.history.pushState = function(...args) {
      if (isUploading && args[2] && args[2] !== window.location.pathname) {
        if (!window.confirm('アップロード中です。ページを離れるとアップロードが中断されます。\n\n別タブに切り替えることは可能です。\n\n本当にページを離れますか？')) {
          return
        }
        setBlockNavigation(false)
      }
      return originalPushState.apply(window.history, args)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handleRouteChange)
      window.history.pushState = originalPushState
    }
  }, [isUploading])

  // 現在のプランを取得
  useEffect(() => {
    const fetchCurrentPlan = async () => {
      try {
        // ゲストIDを取得
        let guestId = null
        if (typeof window !== 'undefined') {
          guestId = localStorage.getItem('interview-guest-id')
        }

        console.log('[INTERVIEW] Fetching current plan...', { guestId: guestId || 'null' })

        const res = await fetch('/api/interview/plan/current', {
          headers: guestId ? { 'x-guest-id': guestId } : {},
        })
        if (res.ok) {
          const data = await res.json()
          console.log('[INTERVIEW] Current plan API response:', data)
          const receivedPlan = data.plan || 'GUEST'
          console.log('[INTERVIEW] Setting current plan to:', receivedPlan)
          setCurrentPlan(receivedPlan)
          if (data.guestFirstAccessAt) {
            setGuestFirstAccessAt(new Date(data.guestFirstAccessAt))
          }
          console.log('[INTERVIEW] Current plan state updated:', receivedPlan)
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('[INTERVIEW] Failed to fetch current plan:', res.status, errorData)
        }
      } catch (error) {
        console.error('[INTERVIEW] Failed to fetch current plan:', error)
      }
    }

    fetchCurrentPlan()
  }, [])

  // 有効なプランを取得（1時間使い放題機能を考慮）
  const effectivePlan = useMemo(() => {
    const plan = getEffectivePlan(currentPlan, guestFirstAccessAt)
    // 無効なプランの場合はGUESTをデフォルトとする
    if (!plan || !PLAN_LIMITS[plan]) {
      console.warn('[INTERVIEW] Invalid plan detected, defaulting to GUEST:', plan)
      return 'GUEST'
    }
    return plan
  }, [currentPlan, guestFirstAccessAt])
  
  // プラン制限情報を取得（安全に取得）
  const planLimits = useMemo(() => {
    const limits = PLAN_LIMITS[effectivePlan]
    if (!limits) {
      console.error('[INTERVIEW] Plan limits not found for plan:', effectivePlan)
      return PLAN_LIMITS.GUEST // フォールバック
    }
    return limits
  }, [effectivePlan])
  
  // 最大ファイルサイズ（音声・動画別）
  const maxAudioFileSize = useMemo(() => {
    try {
      return getMaxFileSize(effectivePlan, false)
    } catch (error) {
      console.error('[INTERVIEW] Failed to get max audio file size:', error)
      return PLAN_LIMITS.GUEST.maxAudioFileSize // フォールバック
    }
  }, [effectivePlan])
  
  const maxVideoFileSize = useMemo(() => {
    try {
      return getMaxFileSize(effectivePlan, true)
    } catch (error) {
      console.error('[INTERVIEW] Failed to get max video file size:', error)
      return PLAN_LIMITS.GUEST.maxVideoFileSize // フォールバック
    }
  }, [effectivePlan])
  
  // ファイルサイズの表示用フォーマット
  const formatFileSizeDisplay = useCallback((bytes: number | bigint) => {
    const size = Number(bytes)
    if (isNaN(size) || size < 0) {
      return '0KB'
    }
    if (size >= 1024 * 1024 * 1024) {
      return `${(size / 1024 / 1024 / 1024).toFixed(2)}GB`
    } else if (size >= 1024 * 1024) {
      return `${(size / 1024 / 1024).toFixed(0)}MB`
    } else if (size >= 1024) {
      return `${(size / 1024).toFixed(0)}KB`
    } else {
      return `${size}B`
    }
  }, [])

  // 進捗に応じたmoodの計算
  const overlayMood = useMemo<OverlayMood>(() => {
    if (progress < 35) return 'search'
    if (progress < 70) return 'think'
    return 'happy'
  }, [progress])

  // ステージテキストの設定
  const stageText = useMemo(() => {
    switch (uploadStatus) {
      case 'uploading':
        return 'ファイルをアップロード中...'
      case 'transcribing':
        return '文字起こしを実行中...'
      case 'analyzing':
        return '構成案を生成中...'
      case 'generating':
        return '記事を生成中...'
      default:
        return '処理中...'
    }
  }, [uploadStatus])

  // 処理時間の推定（ファイルサイズとタイプから計算）- 残り秒数を返す
  // より正確な処理時間の計算に改善
  const estimatedSeconds = useMemo(() => {
    if (!uploadedFile || !isUploading) return null

    const fileSizeMB = uploadedFile.size / (1024 * 1024)
    const fileSizeGB = fileSizeMB / 1024
    let totalSeconds = 0

    // 1. アップロード時間の推定（より現実的な値に修正）
    if (USE_CHUNK_UPLOAD && uploadedFile.size > VERCEL_LIMIT) {
      // チャンクアップロードの場合
      const totalChunks = Math.ceil(uploadedFile.size / CHUNK_SIZE)
      // チャンクあたり1-2秒（ネットワーク状況による、大きいファイルほど遅くなる）
      const chunkUploadTimePerChunk = Math.max(1, Math.min(3, 1 + (fileSizeGB * 0.1))) // 1GBあたり0.1秒追加
      const chunkUploadTime = totalChunks * chunkUploadTimePerChunk
      const mergeTime = Math.max(3, fileSizeGB * 2) // 結合時間（大きいファイルほど時間がかかる）
      totalSeconds += chunkUploadTime + mergeTime
    } else {
      // 通常アップロードの場合（実際のネットワーク速度を考慮）
      const uploadSpeedMBps = 5 // 5MB/秒（より現実的な値）
      totalSeconds += fileSizeMB / uploadSpeedMBps
    }

    // 2. 文字起こし時間の推定（音声・動画の場合）
    if (materialType === 'audio' || materialType === 'video') {
      // ファイルサイズから音声長を推定（より現実的な値に修正）
      // MP3 (128kbps): 1時間 ≈ 約56MB、1GB ≈ 約18時間
      // 動画 (H.264, 1080p): 圧縮率が高いため、音声長はファイルサイズから推定が困難
      // より現実的な推定: 1GBの動画 ≈ 約1-2時間、1GBのMP3 ≈ 約18時間
      let audioLengthMinutes = 0
      
      if (materialType === 'video') {
        // 動画ファイルの場合: ファイルサイズから音声長を推定（より保守的）
        // 1GBの動画 ≈ 約1時間（一般的な1080p動画）
        audioLengthMinutes = fileSizeGB * 60 // 1GB ≈ 1時間
      } else {
        // 音声ファイルの場合: MP3 (128kbps)基準
        // 1GB ≈ 約18時間、1MB ≈ 約1.08分
        audioLengthMinutes = fileSizeMB * 1.08 // より正確な推定
      }
      
      if (materialType === 'video') {
        // 動画ファイルの場合: 音声抽出時間 + 文字起こし時間
        // 音声抽出時間: FFmpeg処理（動画の長さに比例、1分の動画 ≈ 約5-10秒）
        const extractionTime = audioLengthMinutes * 8 // 1分の動画 ≈ 約8秒（FFmpeg処理）
        totalSeconds += extractionTime
        
        // 文字起こし時間: Google Cloud Speech-to-Textは音声長の約0.3-0.5倍
        const transcriptionTime = audioLengthMinutes * 60 * 0.3 // 音声長の30%（リアルタイムファクター）
        totalSeconds += transcriptionTime
      } else {
        // 音声ファイルの場合: 文字起こし時間のみ
        // Google Cloud Speech-to-Textは音声長の約0.3-0.5倍
        const transcriptionTime = audioLengthMinutes * 60 * 0.3 // 音声長の30%（リアルタイムファクター）
        totalSeconds += transcriptionTime
      }
    }

    // 3. 構成案生成時間の推定
    // 文字起こしテキストの長さを推定（1分の音声 ≈ 800-1200文字、平均1000文字）
    let estimatedTextLength = 0
    if (materialType === 'audio' || materialType === 'video') {
      // 音声長を再計算（上記と同じロジック）
      const audioLengthMinutes = materialType === 'video' 
        ? fileSizeGB * 60 // 1GB ≈ 1時間
        : fileSizeMB * 1.08 // 1MB ≈ 約1.08分（MP3 128kbps）
      estimatedTextLength = audioLengthMinutes * 1000 // 1分あたり1000文字
    } else if (materialType === 'text' || materialType === 'pdf') {
      // テキストファイルの場合はファイルサイズから推定（1KB ≈ 500文字）
      estimatedTextLength = (uploadedFile.size / 1024) * 500
    }

    // 構成案生成: Gemini APIの実際の処理時間を考慮
    // 1000文字あたり10-15秒（APIの応答時間とトークン生成時間）
    const outlineTime = (estimatedTextLength / 1000) * 12 // 平均12秒
    totalSeconds += outlineTime

    // 4. 記事生成時間の推定
    // 記事生成: Gemini APIの実際の処理時間を考慮
    // 1000文字あたり20-30秒（より長いテキスト生成のため時間がかかる）
    const articleTime = (estimatedTextLength / 1000) * 25 // 平均25秒
    totalSeconds += articleTime

    // バッファ時間を追加（ネットワーク遅延、API待機時間など）
    const bufferTime = Math.max(30, totalSeconds * 0.1) // 最低30秒、または全体の10%
    totalSeconds += bufferTime

    // 現在の進捗に応じて残り時間を計算
    const currentProgress = progress / 100
    const remainingSeconds = Math.ceil(totalSeconds * (1 - currentProgress))

    return remainingSeconds
  }, [uploadedFile, materialType, progress, isUploading])

  const validateFile = (file: File): { valid: boolean; error?: string; details?: string; useChunk?: boolean } => {
    // ファイルタイプを判定
    const mimeType = file.type
    const fileName = file.name.toLowerCase()
    const extension = fileName.split('.').pop()
    const isVideoFile = SUPPORTED_VIDEO_TYPES.includes(mimeType) || ['mp4', 'mov', 'avi', 'webm'].includes(extension || '')
    const isAudioFile = SUPPORTED_AUDIO_TYPES.includes(mimeType) || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension || '')

    // プラン別のファイルサイズ制限を取得
    const effectivePlan = getEffectivePlan(currentPlan, guestFirstAccessAt)
    const maxFileSize = getMaxFileSize(effectivePlan, isVideoFile)

    console.log('[INTERVIEW] validateFile called:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      isVideoFile,
      currentPlan,
      effectivePlan,
      maxFileSize: `${(maxFileSize / 1024 / 1024 / 1024).toFixed(2)}GB`,
      guestFirstAccessAt,
    })

    // 動画ファイルが許可されていないプランの場合
    if (isVideoFile && maxFileSize === 0) {
      console.error('[INTERVIEW] Video file not allowed:', {
        effectivePlan,
        maxFileSize,
        currentPlan,
      })
      return {
        valid: false,
        error: '動画ファイルはアップロードできません',
        details: `現在のプラン（${effectivePlan === 'GUEST' ? 'ゲスト' : effectivePlan === 'FREE' ? '無料' : effectivePlan}）では動画ファイルのアップロードはできません。\n\n動画ファイルをアップロードするには、PROプランまたはEnterpriseプランにアップグレードしてください。\n\nまたは、動画から音声を抽出してMP3形式でアップロードすることをおすすめします。`,
      }
    }

    // ファイルサイズチェック（プラン別の制限に合わせる）
    if (!isFileSizeWithinLimit(file.size, effectivePlan, isVideoFile)) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
      const fileSizeGB = (file.size / 1024 / 1024 / 1024).toFixed(2)
      const maxSizeMB = (maxFileSize / 1024 / 1024).toFixed(0)
      const maxSizeGB = (maxFileSize / 1024 / 1024 / 1024).toFixed(2)
      const planName = effectivePlan === 'GUEST' ? 'ゲスト' : effectivePlan === 'FREE' ? '無料' : effectivePlan
      
      return {
        valid: false,
        error: 'ファイルサイズが大きすぎます',
        details: `現在のプラン（${planName}）の最大ファイルサイズ: ${maxSizeGB}GB（${maxSizeMB}MB）\n現在のファイルサイズ: ${formatFileSize(file.size)}（${fileSizeMB}MB = ${fileSizeGB}GB）\n\n${maxSizeGB}GB（${maxSizeMB}MB）を超えるファイルはアップロードできません。\n\n対処方法:\n1. ファイルを分割してアップロードしてください（推奨: ${maxSizeMB}MB以下）\n2. 動画ファイルの場合は、音声のみを抽出してください\n3. 音声ファイルの場合は、圧縮してからアップロードしてください\n4. より大きなファイルをアップロードするには、プランをアップグレードしてください`,
      }
    }
    
    // チャンクアップロードが無効化されている場合、4.5MBを超えるファイルはエラー
    if (!USE_CHUNK_UPLOAD && file.size > VERCEL_LIMIT) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
      const limitMB = (VERCEL_LIMIT / 1024 / 1024).toFixed(2)
      return {
        valid: false,
        error: 'ファイルサイズが大きすぎます',
        details: `最大ファイルサイズ: ${limitMB}MB\n現在のファイルサイズ: ${formatFileSize(file.size)}（${fileSizeMB}MB > ${limitMB}MB）\n\n${limitMB}MBを超えるファイルはアップロードできません。ファイルを分割するか、より小さなファイルサイズに圧縮してください。`,
      }
    }
    
    // チャンクアップロードが有効な場合、4.5MBを超える場合はチャンクアップロードを使用
    if (USE_CHUNK_UPLOAD && file.size > VERCEL_LIMIT) {
      return {
        valid: true,
        useChunk: true, // チャンクアップロードを使用するフラグ
        error: undefined,
        details: undefined,
      }
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: '空のファイルです',
        details: 'ファイルが空のため、アップロードできません。別のファイルを選択してください。',
      }
    }

    // ファイルタイプチェック（既に定義済みのmimeType, fileName, extensionを使用）
    let isSupported = false
    let detectedType: MaterialType = null

    // MIMEタイプで判定
    if (SUPPORTED_AUDIO_TYPES.includes(mimeType) || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension || '')) {
      isSupported = true
      detectedType = 'audio'
    } else if (SUPPORTED_VIDEO_TYPES.includes(mimeType) || ['mp4', 'mov', 'avi', 'webm'].includes(extension || '')) {
      isSupported = true
      detectedType = 'video'
    } else if (SUPPORTED_TEXT_TYPES.includes(mimeType) || ['txt', 'md', 'docx'].includes(extension || '')) {
      isSupported = true
      detectedType = extension === 'docx' ? 'text' : 'text'
    } else if (SUPPORTED_PDF_TYPES.includes(mimeType) || extension === 'pdf') {
      isSupported = true
      detectedType = 'pdf'
    }

    if (!isSupported) {
      return {
        valid: false,
        error: '対応していないファイル形式です',
        details: `対応形式: 音声（MP3, WAV, M4A）、動画（MP4, MOV, AVI）、テキスト（TXT, DOCX）、PDF。\n検出された形式: ${mimeType || '不明'}（拡張子: ${extension || 'なし'}）`,
      }
    }

    return { valid: true }
  }

  // チャンクアップロード処理
  const uploadFileInChunks = async (file: File, projectId: string, guestId: string | null) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    let uploadedChunks = 0
    let lastResult: any = null

    // すべてのチャンクで同じtempFileNameを使用する
    const tempFileName = `${projectId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    console.log(`[CHUNK] Starting chunk upload: ${totalChunks} chunks, file size: ${file.size} bytes, tempFileName: ${tempFileName}`)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('projectId', projectId)
      // chunkはBlobとして送信（FileはBlobのサブクラス）
      formData.append('chunk', chunk, `chunk-${chunkIndex}`)
      formData.append('chunkIndex', chunkIndex.toString())
      formData.append('totalChunks', totalChunks.toString())
      formData.append('fileName', file.name)
      formData.append('fileSize', file.size.toString())
      formData.append('mimeType', file.type || 'application/octet-stream')
      formData.append('tempFileName', tempFileName)

      // デバッグ用ログ
      console.log(`[CHUNK] Sending chunk ${chunkIndex + 1}/${totalChunks}:`, {
        projectId,
        chunkSize: chunk.size,
        chunkIndex,
        totalChunks,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        tempFileName,
      })

      let retryCount = 0
      const maxRetries = 3
      let chunkUploaded = false

      while (retryCount < maxRetries && !chunkUploaded) {
        try {
          console.log(`[CHUNK] Uploading chunk ${chunkIndex + 1}/${totalChunks} (attempt ${retryCount + 1}/${maxRetries})`)
          
          const response = await fetch('/api/interview/materials/upload-chunk', {
            method: 'POST',
            headers: {
              ...(guestId ? { 'x-guest-id': guestId } : {}),
            },
            body: formData,
          })

          if (!response.ok) {
            let errorData: any = {}
            try {
              errorData = await response.json()
            } catch (jsonError) {
              // JSONパースエラーの場合、レスポンステキストを取得
              const responseText = await response.text().catch(() => '')
              console.error(`[CHUNK] Failed to parse error response: ${responseText}`)
              errorData = {
                error: `チャンク ${chunkIndex + 1}/${totalChunks} のアップロードに失敗しました`,
                details: `HTTPステータス: ${response.status} ${response.statusText}\n${responseText || 'エラーの詳細が取得できませんでした'}`,
              }
            }
            
            const errorMsg = errorData.error || `チャンク ${chunkIndex + 1}/${totalChunks} のアップロードに失敗しました`
            const errorDetails = errorData.details || ''
            
            // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
            const isQuotaError = errorMsg.includes('容量制限') || 
                                errorMsg.includes('Storage quota') || 
                                errorMsg.includes('quota exceeded') || 
                                errorMsg.includes('1GB maximum') ||
                                errorMsg.includes('Hobby plan') ||
                                response.status === 507
            
            if (isQuotaError) {
              console.error(`[CHUNK] Quota error detected, stopping upload: ${errorMsg}`)
              throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
            }
            
            // 400系エラー（バリデーションエラー）の場合はリトライしない
            if (response.status >= 400 && response.status < 500) {
              console.error(`[CHUNK] Client error (${response.status}), stopping retry: ${errorMsg}`)
              throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
            }
            
            throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
          }

          let result: any = {}
          try {
            result = await response.json()
          } catch (jsonError) {
            // JSONパースエラーの場合
            const responseText = await response.text().catch(() => '')
            console.error(`[CHUNK] Failed to parse response JSON: ${responseText}`)
            throw new Error(`サーバーからの応答を解析できませんでした。HTTPステータス: ${response.status}\n${responseText || '応答が空です'}`)
          }
          
          lastResult = result

          console.log(`[CHUNK] Chunk ${chunkIndex + 1}/${totalChunks} uploaded. Completed: ${result.completed}, Progress: ${result.uploadedChunks || uploadedChunks + 1}/${result.totalChunks || totalChunks}, Error: ${result.error || 'none'}`)

          // エラーが返されている場合は、すぐにエラーを投げる（容量制限エラーを含む）
          if (result.error) {
            const errorDetails = result.details || ''
            const errorMsg = result.error || 'エラーが発生しました'
            
            // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
            const isQuotaError = errorMsg.includes('容量制限') || 
                                errorMsg.includes('Storage quota') || 
                                errorMsg.includes('quota exceeded') || 
                                errorMsg.includes('1GB maximum') ||
                                errorMsg.includes('Hobby plan') ||
                                response.status === 507
            
            if (isQuotaError) {
              console.error(`[CHUNK] Quota error detected, stopping upload: ${errorMsg}`)
              throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
            }
            
            // その他のエラーもすぐに投げる
            console.error(`[CHUNK] Error in response: ${errorMsg}`)
            throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
          }

          // 進捗を更新
          uploadedChunks++
          const chunkProgress = Math.round((uploadedChunks / totalChunks) * 100)
          setProgress(30 + Math.round((chunkProgress * 20) / 100)) // 30%から50%の間で進捗表示

          // すべてのチャンクがアップロード完了（最後のチャンクの場合）
          if (result.completed && result.material && result.material.id) {
            console.log(`[CHUNK] All chunks uploaded successfully. Material ID: ${result.material.id}`)
            return result
          }

          // 最後のチャンクの場合、結合処理が完了するまで少し待機
          if (chunkIndex === totalChunks - 1 && !result.completed) {
            console.log(`[CHUNK] Last chunk uploaded, waiting for merge to complete...`)
            // 結合処理が完了するまで最大10秒待機
            for (let waitCount = 0; waitCount < 10; waitCount++) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              // 最後のチャンクを再送信して状態を確認
              const lastChunkSlice = file.slice(start, end)
              const checkFormData = new FormData()
              checkFormData.append('projectId', projectId)
              checkFormData.append('chunk', lastChunkSlice)
              checkFormData.append('chunkIndex', chunkIndex.toString())
              checkFormData.append('totalChunks', totalChunks.toString())
              checkFormData.append('fileName', file.name)
              checkFormData.append('fileSize', file.size.toString())
              checkFormData.append('mimeType', file.type || '')
              checkFormData.append('tempFileName', tempFileName)

              try {
                const checkRes = await fetch('/api/interview/materials/upload-chunk', {
                  method: 'POST',
                  headers: {
                    ...(guestId ? { 'x-guest-id': guestId } : {}),
                  },
                  body: checkFormData,
                })
                if (checkRes.ok) {
                  let checkResult: any = {}
                  try {
                    checkResult = await checkRes.json()
                  } catch (jsonError) {
                    // JSONパースエラーの場合、続行
                    console.warn(`[CHUNK] Failed to parse check response JSON, continuing...`)
                    continue
                  }
                  
                  // エラーが返されている場合は、すぐにエラーを投げる
                  if (checkResult.error) {
                    const errorDetails = checkResult.details || ''
                    const errorMsg = checkResult.error || 'エラーが発生しました'
                    
                    // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
                    const isQuotaError = errorMsg.includes('容量制限') || 
                                        errorMsg.includes('Storage quota') || 
                                        errorMsg.includes('quota exceeded') || 
                                        errorMsg.includes('1GB maximum') ||
                                        errorMsg.includes('Hobby plan') ||
                                        checkRes.status === 507
                    
                    if (isQuotaError) {
                      console.error(`[CHUNK] Quota error detected in wait check (ok), stopping: ${errorMsg}`)
                      throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
                    }
                    
                    throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
                  }
                  
                  if (checkResult.completed && checkResult.material && checkResult.material.id) {
                    console.log(`[CHUNK] Merge completed after wait. Material ID: ${checkResult.material.id}`)
                    return checkResult
                  }
                } else {
                  // エラーレスポンスを確認
                  let errorData: any = {}
                  try {
                    errorData = await checkRes.json()
                  } catch (jsonError) {
                    // JSONパースエラーの場合、レスポンステキストを取得
                    const responseText = await checkRes.text().catch(() => '')
                    console.error(`[CHUNK] Failed to parse error response: ${responseText}`)
                    errorData = {
                      error: `サーバーエラーが発生しました`,
                      details: `HTTPステータス: ${checkRes.status} ${checkRes.statusText}\n${responseText || 'エラーの詳細が取得できませんでした'}`,
                    }
                  }
                  
                  if (errorData.error) {
                    const errorDetails = errorData.details || ''
                    const errorMsg = errorData.error || 'エラーが発生しました'
                    
                    // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
                    const isQuotaError = errorMsg.includes('容量制限') || 
                                        errorMsg.includes('Storage quota') || 
                                        errorMsg.includes('quota exceeded') || 
                                        errorMsg.includes('1GB maximum') ||
                                        errorMsg.includes('Hobby plan') ||
                                        checkRes.status === 507
                    
                    if (isQuotaError) {
                      console.error(`[CHUNK] Quota error detected in wait check (not ok), stopping: ${errorMsg}`)
                      throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
                    }
                    
                    throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
                  }
                }
              } catch (checkError) {
                console.warn(`[CHUNK] Check attempt ${waitCount + 1} failed:`, checkError)
              }
            }
          }

          // チャンクのアップロード成功
          chunkUploaded = true
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー'
          
          // 容量制限エラーの場合は、リトライせずにすぐにエラーを投げる
          const isQuotaError = errorMessage.includes('容量制限') || 
                              errorMessage.includes('Storage quota') || 
                              errorMessage.includes('quota exceeded') || 
                              errorMessage.includes('1GB maximum') ||
                              errorMessage.includes('Hobby plan')
          
          if (isQuotaError) {
            console.error(`[CHUNK] Quota error detected, stopping retry: ${errorMessage}`)
            throw error
          }
          
          retryCount++
          console.error(`[CHUNK] Chunk ${chunkIndex + 1}/${totalChunks} upload failed (attempt ${retryCount}/${maxRetries}):`, error)
          
          if (retryCount >= maxRetries) {
            throw new Error(`チャンク ${chunkIndex + 1}/${totalChunks} のアップロードに失敗しました（${maxRetries}回リトライしました）\n${errorMessage}`)
          }
          // リトライ前に少し待機
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
        }
      }

      if (!chunkUploaded) {
        throw new Error(`チャンク ${chunkIndex + 1}/${totalChunks} のアップロードに失敗しました`)
      }
    }

    // すべてのチャンクをアップロードしたが、完了レスポンスが返ってこなかった場合
    // 最後のレスポンスを確認
    if (lastResult && lastResult.completed && lastResult.material && lastResult.material.id) {
      console.log(`[CHUNK] Upload completed from last result. Material ID: ${lastResult.material.id}`)
      return lastResult
    }

    // すべてのチャンクをアップロードしたが、完了レスポンスが返ってこなかった場合
    // 最後のチャンクを再度送信して、完了状態を確認（サーバー側でファイル結合が完了するまで少し待機）
    console.log(`[CHUNK] All chunks uploaded, waiting for server to complete file merge...`)
    
    // 最初に少し待機（結合処理が開始される時間を確保）
    await new Promise(resolve => setTimeout(resolve, 5000)) // 5秒に延長
    
    // 待機時間を延長（最大120秒）
    for (let waitAttempt = 0; waitAttempt < 60; waitAttempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2秒待機
      
      try {
        const lastChunkIndex = totalChunks - 1
        const start = lastChunkIndex * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const lastChunk = file.slice(start, end)

        const formData = new FormData()
        formData.append('projectId', projectId)
        formData.append('chunk', lastChunk)
        formData.append('chunkIndex', lastChunkIndex.toString())
        formData.append('totalChunks', totalChunks.toString())
        formData.append('fileName', file.name)
        formData.append('fileSize', file.size.toString())
        formData.append('mimeType', file.type || '')
        formData.append('tempFileName', tempFileName)

        const checkResponse = await fetch('/api/interview/materials/upload-chunk', {
          method: 'POST',
          headers: {
            ...(guestId ? { 'x-guest-id': guestId } : {}),
          },
          body: formData,
        })

        if (checkResponse.ok) {
          let checkResult: any = {}
          try {
            checkResult = await checkResponse.json()
          } catch (jsonError) {
            // JSONパースエラーの場合
            const responseText = await checkResponse.text().catch(() => '')
            console.error(`[CHUNK] Failed to parse check response JSON: ${responseText}`)
            // JSONパースエラーは一時的な問題の可能性があるので、続行
            continue
          }
          
          // エラーが返されている場合は、すぐにエラーを投げる（容量制限エラーの場合も含む）
          if (checkResult.error) {
            const errorDetails = checkResult.details || ''
            const errorMsg = checkResult.error || 'エラーが発生しました'
            
            // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
            const isQuotaError = errorMsg.includes('容量制限') || 
                                errorMsg.includes('Storage quota') || 
                                errorMsg.includes('quota exceeded') || 
                                errorMsg.includes('1GB maximum') ||
                                errorMsg.includes('Hobby plan') ||
                                checkResponse.status === 507
            
            if (isQuotaError) {
              console.error(`[CHUNK] Quota error detected in wait loop (ok), stopping: ${errorMsg}`)
              throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
            }
            
            throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
          }
          
          if (checkResult.completed && checkResult.material && checkResult.material.id) {
            console.log(`[CHUNK] Upload completed after wait (attempt ${waitAttempt + 1}). Material ID: ${checkResult.material.id}`)
            return checkResult
          }
        } else {
          // エラーレスポンスを確認
          let errorData: any = {}
          try {
            errorData = await checkResponse.json()
          } catch (jsonError) {
            // JSONパースエラーの場合、レスポンステキストを取得
            const responseText = await checkResponse.text().catch(() => '')
            console.error(`[CHUNK] Failed to parse error response: ${responseText}`)
            errorData = {
              error: `サーバーエラーが発生しました`,
              details: `HTTPステータス: ${checkResponse.status} ${checkResponse.statusText}\n${responseText || 'エラーの詳細が取得できませんでした'}`,
            }
          }
          
          if (errorData.error) {
            const errorDetails = errorData.details || ''
            const errorMsg = errorData.error || 'エラーが発生しました'
            
            // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
            const isQuotaError = errorMsg.includes('容量制限') || 
                                errorMsg.includes('Storage quota') || 
                                errorMsg.includes('quota exceeded') || 
                                errorMsg.includes('1GB maximum') ||
                                errorMsg.includes('Hobby plan') ||
                                checkResponse.status === 507
            
            if (isQuotaError) {
              console.error(`[CHUNK] Quota error detected in wait loop (not ok), stopping: ${errorMsg}`)
              throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
            }
            
            throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
          }
        }
      } catch (checkError) {
        // 容量制限エラーの場合は、すぐにエラーを投げる（リトライしない）
        const errorMessage = checkError instanceof Error ? checkError.message : '不明なエラー'
        const isQuotaError = errorMessage.includes('容量制限') || 
                            errorMessage.includes('Storage quota') || 
                            errorMessage.includes('quota exceeded') || 
                            errorMessage.includes('1GB maximum') ||
                            errorMessage.includes('Hobby plan')
        
        if (isQuotaError) {
          console.error(`[CHUNK] Quota error in catch block, stopping: ${errorMessage}`)
          throw checkError
        }
        
        // エラーが発生した場合、それが最終的なエラーでない限り続行
        if (waitAttempt === 59) {
          // 最後の試行でエラーが発生した場合
          const finalErrorMsg = errorMessage.includes('Google Cloud Storage') || 
                               errorMessage.includes('GCS') ||
                               errorMessage.includes('認証') ||
                               errorMessage.includes('権限')
            ? errorMessage
            : `ファイルのアップロードが完了しませんでした。\nアップロードしたチャンク数: ${uploadedChunks}/${totalChunks}\nエラー: ${errorMessage}\n\nサーバー側でファイルの結合またはGoogle Cloud Storageへのアップロードが完了していない可能性があります。\n\n対処方法:\n1. しばらく待ってから再度お試しください\n2. ファイルサイズを確認してください（推奨: 200MB以下）\n3. もしまだエラーが続く場合は、プロジェクト一覧から該当プロジェクトを確認してください\n4. 環境変数（GOOGLE_CLOUD_PROJECT_ID、GOOGLE_APPLICATION_CREDENTIALS、GCS_BUCKET_NAME）が正しく設定されているか確認してください`
          throw new Error(finalErrorMsg)
        }
        console.error(`[CHUNK] Wait attempt ${waitAttempt + 1} failed:`, checkError)
      }
    }

    // 120秒待機しても完了しなかった場合
    throw new Error(`ファイルのアップロードが完了しませんでした。\nアップロードしたチャンク数: ${uploadedChunks}/${totalChunks}\n\nサーバー側でファイルの結合またはGoogle Cloud Storageへのアップロードが完了していない可能性があります。\n\n対処方法:\n1. しばらく待ってから再度お試しください\n2. 大きなファイル（500MB以上）の場合は、時間がかかる場合があります\n3. もしまだエラーが続く場合は、プロジェクト一覧から該当プロジェクトを確認してください\n4. 環境変数（GOOGLE_CLOUD_PROJECT_ID、GOOGLE_APPLICATION_CREDENTIALS、GCS_BUCKET_NAME）が正しく設定されているか確認してください`)
  }

  const handleFileSelect = async (file: File) => {
    // エラーメッセージをクリア
    setErrorMessage(null)
    setErrorDetails(null)

    // ファイル検証
    const validation = validateFile(file)
    if (!validation.valid) {
      setErrorMessage(validation.error || 'ファイルの検証に失敗しました')
      setErrorDetails(validation.details || null)
      setUploadStatus('error')
      return
    }

    // ファイルタイプ判定
    const mimeType = file.type
    const fileName = file.name.toLowerCase()
    const extension = fileName.split('.').pop()
    let type: MaterialType = null

    if (SUPPORTED_AUDIO_TYPES.includes(mimeType) || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension || '')) {
      type = 'audio'
    } else if (SUPPORTED_VIDEO_TYPES.includes(mimeType) || ['mp4', 'mov', 'avi', 'webm'].includes(extension || '')) {
      type = 'video'
    } else if (SUPPORTED_TEXT_TYPES.includes(mimeType) || ['txt', 'md'].includes(extension || '')) {
      type = 'text'
    } else if (extension === 'docx') {
      type = 'text'
    } else if (SUPPORTED_PDF_TYPES.includes(mimeType) || extension === 'pdf') {
      type = 'pdf'
    }

    if (!type) {
      setErrorMessage('ファイル形式を判定できませんでした')
      setErrorDetails('ファイルの拡張子またはMIMEタイプを確認してください。')
      setUploadStatus('error')
      return
    }

    setUploadedFile(file)
    setMaterialType(type)
    setUploadStatus('idle') // エラー状態をリセット
    await startUploadProcess(file, type)
  }

  const startUploadProcess = async (file: File, type: MaterialType) => {
    try {
      setErrorMessage(null)
      setErrorDetails(null)

      // 1. プロジェクト作成
      setUploadStatus('uploading')
      setProgress(10)

      let projectRes
      try {
        // ゲストIDを生成（ローカルストレージから取得または新規生成）
        let guestId = null
        if (typeof window !== 'undefined') {
          guestId = localStorage.getItem('interview-guest-id')
          if (!guestId) {
            guestId = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`
            localStorage.setItem('interview-guest-id', guestId)
          }
        }

        projectRes = await fetch('/api/interview/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-guest-id': guestId } : {}),
          },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, '') || 'アップロードファイル',
            status: 'UPLOADING',
          }),
        })
      } catch (error) {
        throw new Error('ネットワークエラー: サーバーに接続できませんでした。インターネット接続を確認してください。')
      }

      if (!projectRes.ok) {
        const errorData = await projectRes.json().catch(() => ({}))
        const errorMsg = errorData.error || 'プロジェクトの作成に失敗しました'
        const errorDetails = errorData.details || 'もう一度お試しください。問題が続く場合は、サポートにお問い合わせください。'
        throw new Error(`${errorMsg}\n${errorDetails}`)
      }

      const projectData = await projectRes.json()
      const newProjectId = projectData.project?.id

      if (!newProjectId) {
        throw new Error('プロジェクトIDの取得に失敗しました。\nサーバーからの応答が不正です。もう一度お試しください。')
      }

      // サーバーから返されたゲストIDを保存（新規生成された場合）
      if (projectData.guestId && typeof window !== 'undefined') {
        localStorage.setItem('interview-guest-id', projectData.guestId)
      }

      setProjectId(newProjectId)
      setProgress(30)

      // ゲストIDをヘッダーに追加
      let guestId = null
      if (typeof window !== 'undefined') {
        guestId = localStorage.getItem('interview-guest-id')
      }

      // 2. ファイルアップロード（署名付きURLを使用してクライアントから直接GCSにアップロード）
      setUploadStatus('uploading')
      console.log(`[INTERVIEW] Starting direct upload to GCS for file size: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
      
      // 2-1. 署名付きURLを取得
      let signedUrlData
      try {
        console.log('[INTERVIEW] Requesting signed URL for:', file.name, file.size, 'bytes')
        const urlRes = await fetch('/api/interview/materials/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-guest-id': guestId } : {}),
          },
          body: JSON.stringify({
            projectId: newProjectId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || '',
          }),
        })

        if (!urlRes.ok) {
          let errorData: any = {}
          try {
            errorData = await urlRes.json()
          } catch (jsonError) {
            const errorText = await urlRes.text().catch(() => '')
            console.error('[INTERVIEW] Failed to parse error response:', errorText)
            errorData = {
              error: `サーバーエラーが発生しました (HTTP ${urlRes.status})`,
              details: errorText || 'エラーの詳細が取得できませんでした',
            }
          }
          
          const errorMsg = errorData.error || '署名付きURLの取得に失敗しました'
          const errorDetails = errorData.details || 'サーバーエラーが発生しました。'
          
          // 認証エラーの場合は、より詳細なメッセージを表示
          if (urlRes.status === 401 || errorMsg.includes('認証情報') || errorDetails.includes('認証情報')) {
            throw new Error(
              `${errorMsg}\n\n${errorDetails}\n\n` +
              `対処方法:\n` +
              `1. Vercelダッシュボードにログイン\n` +
              `2. プロジェクト設定 > Environment Variables を開く\n` +
              `3. 以下の環境変数を設定:\n` +
              `   - GOOGLE_CLOUD_PROJECT_ID\n` +
              `   - GCS_BUCKET_NAME\n` +
              `   - GOOGLE_APPLICATION_CREDENTIALS (JSON形式)`
            )
          }
          
          throw new Error(`${errorMsg}\n${errorDetails}`)
        }

        signedUrlData = await urlRes.json()
        if (!signedUrlData.signedUrl) {
          throw new Error('署名付きURLの取得に失敗しました。\nサーバーからの応答が不正です。')
        }
        console.log('[INTERVIEW] Signed URL received successfully')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー'
        
        // ネットワークエラーの場合
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
          console.error('[INTERVIEW] Network error:', error)
          throw new Error(
            `ネットワークエラーが発生しました。\n\n` +
            `考えられる原因:\n` +
            `1. インターネット接続が切断されている\n` +
            `2. サーバーが応答していない\n` +
            `3. CORSエラーが発生している\n\n` +
            `対処方法:\n` +
            `1. インターネット接続を確認してください\n` +
            `2. ページをリロードして再度お試しください\n` +
            `3. しばらく待ってから再度お試しください`
          )
        }
        
        throw new Error(`署名付きURLの取得に失敗しました。\n${errorMessage}`)
      }

      // 2-2. 署名付きURLを使用して直接GCSにアップロード
      let uploadProgress = 0
      const maxRetries = 3
      let retryCount = 0
      let lastError: Error | null = null
      
      while (retryCount < maxRetries) {
        try {
          console.log(`[INTERVIEW] Uploading file to GCS (attempt ${retryCount + 1}/${maxRetries}):`, signedUrlData.filePath)
          console.log(`[INTERVIEW] File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
          setProgress(40)
          
          // タイムアウトを設定（ファイルサイズに応じて調整）
          // 大きなファイルの場合、より長いタイムアウトを設定
          // 1MBあたり20秒、最低10分、最大3時間
          const timeoutMs = Math.min(
            3 * 60 * 60 * 1000, // 最大3時間
            Math.max(600000, file.size / 1024 / 1024 * 20000) // 最低10分、1MBあたり20秒
          )
          console.log(`[INTERVIEW] Upload timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes`)
          
          // 大きなファイル（100MB以上）の場合はXMLHttpRequestを使用してプログレス表示
          const useXHR = file.size > 100 * 1024 * 1024 // 100MB以上
          
          try {
            let uploadRes: Response
            
            if (useXHR) {
              // XMLHttpRequestを使用（プログレス表示可能）
              console.log('[INTERVIEW] Using XMLHttpRequest for large file upload with progress tracking')
              console.log('[INTERVIEW] Signed URL:', signedUrlData.signedUrl.substring(0, 100) + '...')
              uploadRes = await new Promise<Response>((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                let isResolved = false
                
                const cleanup = () => {
                  isResolved = true
                }
                
                xhr.upload.addEventListener('progress', (e) => {
                  if (e.lengthComputable && !isResolved) {
                    const percentComplete = (e.loaded / e.total) * 100
                    const uploadProgressPercent = 40 + (percentComplete * 0.05) // 40-45%の範囲
                    setProgress(Math.min(45, uploadProgressPercent))
                    if (Math.floor(percentComplete) % 10 === 0 || percentComplete > 99) {
                      // 10%ごと、または99%以上でログ出力
                      console.log(`[INTERVIEW] Upload progress: ${percentComplete.toFixed(1)}% (${(e.loaded / 1024 / 1024).toFixed(2)} MB / ${(e.total / 1024 / 1024).toFixed(2)} MB)`)
                    }
                  }
                })
                
                xhr.addEventListener('loadend', () => {
                  if (isResolved) return
                  cleanup()
                  
                  console.log(`[INTERVIEW] XHR loadend - status: ${xhr.status}, statusText: ${xhr.statusText}, readyState: ${xhr.readyState}`)
                  
                  // readyStateが4（完了）でない場合はエラー
                  if (xhr.readyState !== 4) {
                    reject(new Error(`Upload incomplete: readyState ${xhr.readyState}`))
                    return
                  }
                  
                  // ステータスコード0はネットワークエラーまたはCORSエラー
                  if (xhr.status === 0) {
                    const errorMsg = 'Network error: Status 0 (possible CORS or network issue)\n\n' +
                      '考えられる原因:\n' +
                      '1. Google Cloud StorageのCORS設定が不足している\n' +
                      '2. ネットワーク接続の問題\n' +
                      '3. 署名付きURLの有効期限切れ\n\n' +
                      '対処方法:\n' +
                      '1. Google Cloud ConsoleでバケットのCORS設定を確認してください\n' +
                      '2. バケット名: doya-interview-storage\n' +
                      '3. 設定方法: バケット詳細 > 構成タブ > CORS設定\n' +
                      '4. 詳細は docs/gcs-cors-setup.md を参照してください'
                    reject(new Error(errorMsg))
                    return
                  }
                  
                  // 成功ステータスコード
                  if (xhr.status >= 200 && xhr.status < 300) {
                    const response = new Response(null, {
                      status: xhr.status,
                      statusText: xhr.statusText,
                      headers: new Headers(),
                    })
                    Object.defineProperty(response, 'ok', {
                      value: true,
                      writable: false,
                      enumerable: true,
                      configurable: false,
                    })
                    resolve(response)
                  } else {
                    // HTTPエラー
                    const errorText = xhr.responseText || xhr.statusText || 'Unknown error'
                    reject(new Error(`HTTP ${xhr.status}: ${errorText}`))
                  }
                })
                
                xhr.addEventListener('error', (e) => {
                  if (isResolved) return
                  cleanup()
                  console.error('[INTERVIEW] XHR error event:', {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    readyState: xhr.readyState,
                    event: e,
                  })
                  const errorMsg = xhr.statusText || 'Network error during upload'
                  reject(new Error(`Network error: ${errorMsg}`))
                })
                
                xhr.addEventListener('abort', () => {
                  if (isResolved) return
                  cleanup()
                  console.warn('[INTERVIEW] XHR abort event')
                  reject(new Error('Upload aborted'))
                })
                
                xhr.addEventListener('timeout', () => {
                  if (isResolved) return
                  cleanup()
                  console.error('[INTERVIEW] XHR timeout event')
                  reject(new Error('Upload timeout'))
                })
                
                try {
                  xhr.open('PUT', signedUrlData.signedUrl, true) // 非同期を明示
                  xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
                  // タイムアウトを設定（ミリ秒）
                  xhr.timeout = timeoutMs
                  console.log(`[INTERVIEW] Starting XHR upload (timeout: ${(timeoutMs / 1000 / 60).toFixed(1)} minutes)...`)
                  xhr.send(file)
                } catch (openError) {
                  cleanup()
                  console.error('[INTERVIEW] XHR open/send error:', openError)
                  reject(new Error(`Failed to start upload: ${openError instanceof Error ? openError.message : 'Unknown error'}`))
                }
              })
            } else {
              // fetch APIを使用（小さなファイル）
              const controller = new AbortController()
              const timeoutId = setTimeout(() => {
                controller.abort()
              }, timeoutMs)
              
              uploadRes = await fetch(signedUrlData.signedUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': file.type || 'application/octet-stream',
                },
                body: file,
                signal: controller.signal,
              })
              
              clearTimeout(timeoutId)
            }

            // レスポンスのチェック
            // XMLHttpRequestの場合は、すでにエラーハンドリングされているため、ここに到達した場合は成功
            if (!uploadRes) {
              throw new Error('No response received from upload')
            }
            
            // Responseオブジェクトのokプロパティをチェック
            const isOk = uploadRes.status >= 200 && uploadRes.status < 300
            if (!isOk) {
              const errorText = await uploadRes.text().catch(() => uploadRes.statusText || 'Unknown error')
              console.error('[INTERVIEW] GCS upload failed:', uploadRes.status, errorText)
              
              // 認証エラーの場合
              if (uploadRes.status === 401 || uploadRes.status === 403) {
                throw new Error(
                  `Google Cloud Storageへのアップロードが拒否されました。\n\n` +
                  `HTTPステータス: ${uploadRes.status} ${uploadRes.statusText}\n\n` +
                  `考えられる原因:\n` +
                  `1. 署名付きURLの有効期限が切れている\n` +
                  `2. サービスアカウントの権限が不足している\n` +
                  `3. バケットへのアクセス権限がない\n\n` +
                  `対処方法:\n` +
                  `1. ページをリロードして再度お試しください\n` +
                  `2. Vercelダッシュボードで環境変数を確認してください`
                )
              }
              
              // 一時的なエラーの場合はリトライ
              if (uploadRes.status >= 500 && retryCount < maxRetries - 1) {
                const retryDelay = Math.min(10000, 3000 * (retryCount + 1)) // 3秒、6秒、9秒（最大10秒）
                console.warn(`[INTERVIEW] Server error ${uploadRes.status}, will retry after ${retryDelay}ms...`)
                lastError = new Error(`HTTP ${uploadRes.status}: ${errorText || uploadRes.statusText}`)
                retryCount++
                await new Promise(resolve => setTimeout(resolve, retryDelay))
                continue
              }
              
              throw new Error(
                `Google Cloud Storageへのアップロードに失敗しました。\n\n` +
                `HTTPステータス: ${uploadRes.status} ${uploadRes.statusText}\n` +
                `エラー詳細: ${errorText || '不明'}`
              )
            }

            console.log(`[INTERVIEW] File uploaded to GCS successfully: ${signedUrlData.filePath}`)
            uploadProgress = 100
            setProgress(45)
            break // 成功したらループを抜ける
          } catch (fetchError: any) {
            // タイムアウトIDのクリア（fetch APIの場合のみ）
            if (!useXHR) {
              // fetch APIの場合はtimeoutIdが定義されている
              // XMLHttpRequestの場合はPromise内で処理されるため、ここでは不要
            }
            
            // AbortError（タイムアウト）の場合
            if (fetchError.name === 'AbortError' || fetchError.message === 'Upload timeout' || fetchError.message === 'Upload aborted') {
              if (retryCount < maxRetries - 1) {
                const retryDelay = Math.min(10000, 3000 * (retryCount + 1)) // 3秒、6秒、9秒（最大10秒）
                console.warn(`[INTERVIEW] Upload timeout, will retry after ${retryDelay}ms...`)
                lastError = new Error('アップロードがタイムアウトしました')
                retryCount++
                await new Promise(resolve => setTimeout(resolve, retryDelay))
                continue
              }
              throw new Error(
                `アップロードがタイムアウトしました。\n\n` +
                `ファイルサイズ: ${(file.size / 1024 / 1024).toFixed(2)} MB\n` +
                `タイムアウト時間: ${(timeoutMs / 1000 / 60).toFixed(1)} 分\n\n` +
                `対処方法:\n` +
                `1. インターネット接続を確認してください（安定した接続が必要です）\n` +
                `2. しばらく待ってから再度お試しください\n` +
                `3. 大きなファイル（500MB以上）の場合は、時間がかかる場合があります`
              )
            }
            
            throw fetchError
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー'
          
          // ネットワークエラーの場合
          if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
            if (retryCount < maxRetries - 1) {
              const retryDelay = Math.min(10000, 3000 * (retryCount + 1)) // 3秒、6秒、9秒（最大10秒）
              console.warn(`[INTERVIEW] Network error, will retry (${retryCount + 1}/${maxRetries}) after ${retryDelay}ms...`)
              lastError = error as Error
              retryCount++
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            }
            
            console.error('[INTERVIEW] Network error during GCS upload (final attempt):', error)
            throw new Error(
              `Google Cloud Storageへのアップロード中にネットワークエラーが発生しました。\n\n` +
              `ファイルサイズ: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n` +
              `考えられる原因:\n` +
              `1. インターネット接続が不安定\n` +
              `2. タイムアウトが発生した（大きなファイルの場合は時間がかかります）\n` +
              `3. ネットワークの一時的な問題\n\n` +
              `対処方法:\n` +
              `1. インターネット接続を確認してください（安定した接続が必要です）\n` +
              `2. しばらく待ってから再度お試しください\n` +
              `3. 大きなファイル（500MB以上）の場合は、時間がかかる場合があります`
            )
          }
          
          // その他のエラーでリトライ可能な場合
          if (retryCount < maxRetries - 1 && !errorMessage.includes('拒否') && !errorMessage.includes('権限')) {
            const retryDelay = Math.min(10000, 3000 * (retryCount + 1)) // 3秒、6秒、9秒（最大10秒）
            console.warn(`[INTERVIEW] Upload error, will retry (${retryCount + 1}/${maxRetries}) after ${retryDelay}ms:`, errorMessage)
            lastError = error as Error
            retryCount++
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            continue
          }
          
          throw error
        }
      }
      
      // すべてのリトライが失敗した場合
      if (uploadProgress < 100 && lastError) {
        throw lastError
      }

      // 2-3. アップロード完了をサーバーに通知
      let uploadData
      try {
        console.log('[INTERVIEW] Notifying server of upload completion')
        const completeRes = await fetch('/api/interview/materials/upload-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(guestId ? { 'x-guest-id': guestId } : {}),
          },
          body: JSON.stringify({
            projectId: newProjectId,
            filePath: signedUrlData.filePath,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || '',
            materialType: type,
          }),
        })

        if (!completeRes.ok) {
          let errorData: any = {}
          try {
            errorData = await completeRes.json()
          } catch (jsonError) {
            const errorText = await completeRes.text().catch(() => '')
            console.error('[INTERVIEW] Failed to parse error response:', errorText)
            errorData = {
              error: `サーバーエラーが発生しました (HTTP ${completeRes.status})`,
              details: errorText || 'エラーの詳細が取得できませんでした',
            }
          }
          
          const errorMsg = errorData.error || 'アップロード完了の処理に失敗しました'
          const errorDetails = errorData.details || 'サーバーエラーが発生しました。'
          throw new Error(`${errorMsg}\n${errorDetails}`)
        }

        uploadData = await completeRes.json()
        if (!uploadData.material?.id) {
          throw new Error('アップロードしたファイルの情報を取得できませんでした。\nサーバーからの応答が不正です。')
        }

        console.log(`[INTERVIEW] Upload completed. Material ID: ${uploadData.material.id}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー'
        
        // ネットワークエラーの場合
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
          console.error('[INTERVIEW] Network error during completion:', error)
          throw new Error(
            `アップロード完了の通知中にネットワークエラーが発生しました。\n\n` +
            `ファイルはGoogle Cloud Storageに保存されている可能性があります。\n` +
            `プロジェクト一覧から確認してください。\n\n` +
            `エラー詳細: ${errorMessage}`
          )
        }
        
        throw new Error(
          `アップロード完了の処理に失敗しました。\n` +
          `ファイルはGoogle Cloud Storageに保存されましたが、データベースへの記録に失敗しました。\n` +
          `プロジェクト一覧から確認してください。\n\n` +
          `エラー詳細: ${errorMessage}`
        )
      }

      setProgress(50)

      // 3. 文字起こし（音声・動画の場合）
      let transcriptionId = null
      const materialId = uploadData.material?.id
      if (!materialId) {
        throw new Error('アップロードしたファイルの情報を取得できませんでした。\nサーバーからの応答が不正です。もう一度お試しください。')
      }

      if (type === 'audio' || type === 'video') {
        setUploadStatus('transcribing')
        setProgress(60)

        try {
          console.log('[INTERVIEW] Requesting transcription for material:', uploadData.material.id)
          // ゲストIDを取得
          let guestId: string | null = null
          try {
            guestId = localStorage.getItem('interview-guest-id')
          } catch (e) {
            console.warn('[INTERVIEW] Failed to get guest ID from localStorage:', e)
          }
          
          const headers: HeadersInit = { 'Content-Type': 'application/json' }
          if (guestId) {
            headers['x-guest-id'] = guestId
          }
          
          console.log('[INTERVIEW] Requesting transcription with headers:', { guestId: guestId || 'null' })
          
          const transcribeRes = await fetch('/api/interview/transcribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              projectId: newProjectId,
              materialId: uploadData.material.id,
            }),
          })

          if (!transcribeRes.ok) {
            const errorData = await transcribeRes.json().catch(() => ({}))
            const errorMsg = errorData.error || '文字起こしに失敗しました'
            const errorDetails = errorData.details || ''
            console.error('[INTERVIEW] Transcription failed:', transcribeRes.status, errorMsg, errorDetails)
            
            // 401エラー（認証エラー）の場合は、より詳細なメッセージを表示
            if (transcribeRes.status === 401) {
              throw new Error(
                `${errorMsg}\n\n${errorDetails || '認証情報が見つかりませんでした。'}\n\n` +
                `解決方法:\n` +
                `1. ページを再読み込みしてください\n` +
                `2. ログインしている場合は、再度ログインしてください\n` +
                `3. 問題が解決しない場合は、サポートにお問い合わせください`
              )
            }
            
            // 413エラー（ファイルサイズ制限）の場合は、より詳細なメッセージを表示
            if (transcribeRes.status === 413) {
              throw new Error(
                `${errorMsg}\n\n${errorDetails}\n\n` +
                `注意: 文字起こし機能は最大1GB（または60分の音声）のファイルに対応しています。\n` +
                `それ以上のファイルの場合は、分割するか、音声のみを抽出してください。`
              )
            }
            
            throw new Error(`${errorMsg}${errorDetails ? '\n' + errorDetails : ''}`)
          }

          const transcribeData = await transcribeRes.json()
          transcriptionId = transcribeData.transcription?.id
          const pollingRequired = transcribeData.pollingRequired || false
          const transcriptionStatus = transcribeData.transcription?.status || 'PROCESSING'
          
          console.log('[INTERVIEW] Transcription response:', {
            transcriptionId,
            status: transcriptionStatus,
            pollingRequired,
          })
          
          if (!transcriptionId) {
            console.warn('[INTERVIEW] Transcription ID not returned, but continuing...')
          } else if (pollingRequired || transcriptionStatus === 'PROCESSING') {
            // 非同期ジョブ方式: 文字起こしが完了するまでポーリング
            console.log('[INTERVIEW] Polling for transcription completion...')
            let retryCount = 0
            const maxRetries = 300 // 最大5分（1秒間隔）
            let completed = false
            
            while (retryCount < maxRetries && !completed) {
              try {
                await new Promise(resolve => setTimeout(resolve, 1000)) // 1秒待機
                
                const statusRes = await fetch(`/api/interview/transcribe/status/${transcriptionId}`, {
                  headers: guestId ? { 'x-guest-id': guestId } : {},
                })
                
                if (statusRes.ok) {
                  const statusData = await statusRes.json()
                  const status = statusData.status
                  
                  console.log('[INTERVIEW] Transcription status:', status, `(attempt ${retryCount + 1}/${maxRetries})`)
                  
                  if (status === 'COMPLETED' && statusData.text && statusData.text.trim().length > 0) {
                    console.log('[INTERVIEW] Transcription completed successfully')
                    completed = true
                    break
                  } else if (status === 'ERROR') {
                    throw new Error(`文字起こし処理でエラーが発生しました: ${statusData.text || 'Unknown error'}`)
                  }
                  // PROCESSINGの場合は継続
                } else {
                  console.warn('[INTERVIEW] Failed to check transcription status:', statusRes.status)
                }
              } catch (checkError) {
                console.warn('[INTERVIEW] Failed to check transcription status:', checkError)
                // エラーが続く場合は、最大試行回数に達するまで継続
              }
              retryCount++
            }
            
            if (!completed) {
              console.warn('[INTERVIEW] Transcription polling timeout, but continuing...')
              // タイムアウトしても処理を継続（バックグラウンドで完了する可能性がある）
            }
          } else {
            // 同期処理の場合（既存の動作）
            console.log('[INTERVIEW] Transcription completed synchronously')
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '文字起こしでエラーが発生しました'
          console.error('[INTERVIEW] Transcription error:', error)
          throw new Error(`文字起こしに失敗しました。\n${errorMessage}`)
        }
        setProgress(75)
      } else if (type === 'text' || type === 'pdf') {
        // テキスト・PDFの場合は抽出テキストを使用
        console.log('[INTERVIEW] Text/PDF file, skipping transcription')
        setProgress(75)
      }

      // 4. 分析・構成案生成
      setUploadStatus('analyzing')
      setProgress(80)

      try {
        console.log('[INTERVIEW] Requesting outline generation for project:', newProjectId)
        
        // ゲストIDを取得
        let guestId: string | null = null
        try {
          guestId = localStorage.getItem('interview-guest-id')
        } catch (e) {
          console.warn('[INTERVIEW] Failed to get guest ID from localStorage:', e)
        }
        
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (guestId) {
          headers['x-guest-id'] = guestId
        }
        
        console.log('[INTERVIEW] Requesting outline with headers:', { guestId: guestId || 'null' })
        
        const outlineRes = await fetch('/api/interview/outline', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            projectId: newProjectId,
          }),
        })

        if (!outlineRes.ok) {
          const errorData = await outlineRes.json().catch(() => ({}))
          const errorMsg = errorData.error || '構成案生成に失敗しました'
          const errorDetails = errorData.details || ''
          console.error('[INTERVIEW] Outline generation failed:', outlineRes.status, errorMsg, errorDetails)
          throw new Error(`${errorMsg}${errorDetails ? '\n' + errorDetails : ''}`)
        }

        const outlineData = await outlineRes.json()
        console.log('[INTERVIEW] Outline generated successfully:', outlineData.outline ? 'Yes' : 'No')
        setProgress(90)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '構成案生成でエラーが発生しました'
        console.error('[INTERVIEW] Outline generation error:', error)
        throw new Error(`構成案生成に失敗しました。\n${errorMessage}`)
      }

      // 5. 記事生成
      setUploadStatus('generating')
      setProgress(92)

      try {
        console.log('[INTERVIEW] Requesting draft generation for project:', newProjectId)
        
        // ゲストIDを取得
        let guestId: string | null = null
        try {
          guestId = localStorage.getItem('interview-guest-id')
        } catch (e) {
          console.warn('[INTERVIEW] Failed to get guest ID from localStorage:', e)
        }
        
        const headers: HeadersInit = { 'Content-Type': 'application/json' }
        if (guestId) {
          headers['x-guest-id'] = guestId
        }
        
        console.log('[INTERVIEW] Requesting draft with headers:', { guestId: guestId || 'null' })
        
        const draftRes = await fetch('/api/interview/draft', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            projectId: newProjectId,
          }),
        })

        if (!draftRes.ok) {
          const errorData = await draftRes.json().catch(() => ({}))
          const errorMsg = errorData.error || '記事生成に失敗しました'
          const errorDetails = errorData.details || ''
          console.error('[INTERVIEW] Draft generation failed:', draftRes.status, errorMsg, errorDetails)
          throw new Error(`${errorMsg}${errorDetails ? '\n' + errorDetails : ''}`)
        }

        const draftData = await draftRes.json()
        console.log('[INTERVIEW] Draft generated successfully:', draftData.draft ? 'Yes' : 'No')
        setProgress(98)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '記事生成でエラーが発生しました'
        console.error('[INTERVIEW] Draft generation error:', error)
        throw new Error(`記事生成に失敗しました。\n${errorMessage}`)
      }

      // 完了
      setUploadStatus('completed')
      setProgress(100)
      
      // 遷移ブロックを解除（完了後すぐに解除）
      setTimeout(() => {
        setBlockNavigation(false)
        // プロジェクト詳細ページに遷移
        setTimeout(() => {
          router.push(`/interview/projects/${newProjectId}`)
        }, 500)
      }, 1000)
    } catch (error) {
      console.error('Upload process error:', error)
      const errorMsg = error instanceof Error ? error.message : '不明なエラーが発生しました'
      
      // エラーメッセージを分割（改行で分割）
      // エラーメッセージを複数行に分割
      const errorLines = errorMsg.split('\n')
      const mainError = errorLines[0] || 'エラーが発生しました'
      
      // ネットワークエラーの場合は、より分かりやすいメッセージに変換
      let displayError = mainError
      if (mainError.includes('Failed to fetch') || mainError.includes('NetworkError')) {
        displayError = 'ネットワークエラーが発生しました'
      }
      let errorDetailsText = errorLines.slice(1).join('\n')
      
      // 容量制限エラーの場合、詳細がない場合はデフォルトのメッセージを追加
      if (mainError.includes('容量制限') || mainError.includes('Storage quota') || mainError.includes('quota exceeded')) {
        if (!errorDetailsText || errorDetailsText.trim() === '') {
          errorDetailsText = 'Google Cloud Storageの容量制限に達しています。\n\n対処方法:\n1. 古いプロジェクトを削除して容量を確保する（3ヶ月経過したプロジェクトは自動削除されます）\n2. 不要なファイルを削除する\n3. Google Cloud Consoleでストレージ使用状況を確認する\n4. ストレージ容量を増やす（必要に応じて）'
        }
      } else if (!errorDetailsText || errorDetailsText.trim() === '') {
        errorDetailsText = '詳細なエラー情報はコンソールを確認してください。問題が続く場合は、サポートにお問い合わせください。'
      }
      
      setErrorMessage(displayError)
      setErrorDetails(errorDetailsText)
      setUploadStatus('error')
      setProgress(0)
      setBlockNavigation(false) // エラー時は遷移ブロックを解除
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const resetUpload = () => {
    setUploadedFile(null)
    setUploadStatus('idle')
    setProgress(0)
    setProjectId(null)
    setMaterialType(null)
    setErrorMessage(null)
    setErrorDetails(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getFileIcon = (type: MaterialType) => {
    switch (type) {
      case 'audio':
        return <Music className="w-16 h-16 text-orange-500" />
      case 'video':
        return <Video className="w-16 h-16 text-orange-500" />
      case 'pdf':
        return <FileText className="w-16 h-16 text-orange-500" />
      default:
        return <File className="w-16 h-16 text-orange-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // アップロード中の進捗ステップ
  const uploadSteps = useMemo(() => {
    const steps = [
      { label: 'アップロード', threshold: 0 },
      { label: '文字起こし', threshold: 30 },
      { label: '構成案生成', threshold: 60 },
      { label: '記事生成', threshold: 80 },
      { label: '完了', threshold: 100 },
    ]
    return steps
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      {/* アップロード中のローディングオーバーレイ */}
      <PartyLoadingOverlay
        open={isUploading}
        mode="party"
        progress={progress}
        stageText={stageText}
        mood={overlayMood}
        steps={uploadSteps}
        mascotSrc="/persona/mascot.svg"
        title="インタビュー処理中"
        cards={[
          { title: 'ファイル処理', subtitle: 'アップロードしたファイルを解析中' },
          { title: '文字起こし', subtitle: '音声・動画からテキストを抽出中' },
          { title: '記事生成', subtitle: 'AIが高品質な記事を作成中' },
        ]}
        showSpec={false}
        estimatedSeconds={estimatedSeconds}
        allowTabSwitch={true}
      />
      {/* ヒーローセクション */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8 sm:mb-10 md:mb-12"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 mb-4 sm:mb-6 shadow-2xl shadow-orange-500/30"
        >
          <Rocket className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
        </motion.div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-3 sm:mb-4">
          <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            ファイルをアップロードするだけ
          </span>
          <br />
          <span className="text-slate-900">AIが自動で記事を生成</span>
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-slate-600 mb-4 max-w-2xl mx-auto px-4">
          音声・動画・テキストをアップロードするだけで、<br className="hidden sm:block" />
          <span className="font-black text-orange-600">自動で文字起こし → 構成案作成 → 記事生成</span>まで一気通貫で完了します
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {[
            { icon: Wand2, text: 'AI自動処理' },
            { icon: Zap, text: '即座に完了' },
            { icon: Sparkles, text: '高品質な記事' },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm"
            >
              <item.icon className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-black text-slate-700">{item.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* エラーメッセージ */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 sm:mb-6 p-4 sm:p-6 bg-gradient-to-br from-red-50 via-red-50 to-orange-50 border-2 border-red-300 rounded-xl sm:rounded-2xl shadow-xl"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-7 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-red-900 mb-2 sm:mb-3 break-words">{errorMessage}</h3>
                {errorDetails && (
                  <div className="text-xs sm:text-sm text-red-800 whitespace-pre-wrap bg-white/80 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-red-200 mb-3 sm:mb-4 shadow-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <HelpCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="font-black text-red-900">詳細情報</p>
                    </div>
                    <p className="text-red-700 leading-relaxed">{errorDetails}</p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={resetUpload}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm sm:text-base font-black rounded-lg sm:rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    やり直す
                  </button>
                  {(errorMessage.includes('プラン') || errorMessage.includes('アップグレード') || errorMessage.includes('動画ファイル')) ? (
                    <Link
                      href="/interview/plan"
                      className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm sm:text-base font-black rounded-lg sm:rounded-xl hover:from-orange-600 hover:to-amber-700 transition-all shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2"
                    >
                      <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                      プランを確認
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* アップロードエリア */}
      <AnimatePresence mode="wait">
        {uploadStatus === 'idle' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`bg-white rounded-2xl sm:rounded-3xl border-2 ${
              isDragging ? 'border-orange-500 bg-orange-50' : 'border-dashed border-slate-300'
            } shadow-xl p-4 sm:p-6 md:p-8 lg:p-12 transition-all`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              className={`text-center transition-all ${
                isDragging ? 'scale-105' : ''
              }`}
            >
              <motion.div
                animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-6"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 mb-4 sm:mb-6 shadow-lg">
                  <Upload className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-orange-500" />
                </div>
              </motion.div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mb-2">
                {isDragging ? (
                  <>
                    <span className="text-orange-600">ここにドロップ！</span>
                  </>
                ) : (
                  <>
                    ファイルを<span className="text-orange-600">ドラッグ&ドロップ</span>
                  </>
                )}
              </h2>
              <p className="text-slate-600 mb-2 text-sm sm:text-base md:text-lg">
                またはクリックしてファイルを選択
              </p>
              {/* プラン情報カード - より目立つデザイン */}
              <div className="mb-4 sm:mb-6 p-4 sm:p-5 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 rounded-xl sm:rounded-2xl border-2 border-orange-300 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3">
                  <div className="flex-1 w-full sm:w-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm md:text-base font-black text-slate-900">現在のプラン</p>
                        <p className="text-lg sm:text-xl md:text-2xl font-black text-orange-600">{planLimits.planName}</p>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 font-medium mb-2 sm:mb-3">{planLimits.description}</p>
                  </div>
                  {maxVideoFileSize === 0 && (
                    <Link
                      href="/interview/plan"
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs sm:text-sm font-black rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all whitespace-nowrap text-center"
                    >
                      プランを見る
                    </Link>
                  )}
                </div>
                
                {/* ファイルサイズ制限を視覚的に表示 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="p-3 bg-white rounded-xl border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Music className="w-4 h-4 text-purple-600" />
                      <p className="text-xs font-black text-slate-700">音声ファイル</p>
                    </div>
                    <p className="text-lg font-black text-orange-600">{formatFileSizeDisplay(maxAudioFileSize)}</p>
                    <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, (maxAudioFileSize / (10 * 1024 * 1024 * 1024)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl border ${
                    maxVideoFileSize > 0 
                      ? 'bg-white border-blue-200' 
                      : 'bg-slate-100 border-slate-300 opacity-75'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Video className={`w-4 h-4 ${maxVideoFileSize > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                      <p className={`text-xs font-black ${maxVideoFileSize > 0 ? 'text-slate-700' : 'text-slate-500'}`}>
                        動画ファイル
                      </p>
                    </div>
                    {maxVideoFileSize > 0 ? (
                      <>
                        <p className="text-lg font-black text-orange-600">{formatFileSizeDisplay(maxVideoFileSize)}</p>
                        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, (maxVideoFileSize / (10 * 1024 * 1024 * 1024)) * 100))}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-black text-red-600">利用不可</p>
                        <p className="text-xs text-slate-500 mt-1">PRO以上で利用可能</p>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="pt-3 border-t border-orange-200">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-black">※</span> クライアントから直接Google Cloud Storageにアップロードします
                    <br />
                    <span className="font-black">※</span> 文字起こし機能を使用するため、プラン別の制限が適用されます
                    <br />
                    <span className="font-black">※</span> 大きなファイルも対応可能です（時間がかかる場合があります）
                  </p>
                </div>
              </div>

              {/* 処理時間の目安表 */}
              <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl sm:rounded-2xl border-2 border-blue-200 shadow-lg">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900">処理時間の目安</h3>
                </div>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full border-collapse bg-white rounded-xl shadow-md border border-slate-200">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-500 to-indigo-600">
                        <th className="px-4 py-3 text-left text-white font-black text-sm border-b-2 border-blue-600">ファイルサイズ</th>
                        <th className="px-4 py-3 text-left text-white font-black text-sm border-b-2 border-blue-600">動画ファイル</th>
                        <th className="px-4 py-3 text-left text-white font-black text-sm border-b-2 border-blue-600">音声ファイル（MP3推奨）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // プランに応じた処理時間表を生成
                        const rows = []
                        const sizes = [
                          { size: 1, label: '1GB' },
                          { size: 2, label: '2GB' },
                          { size: 5, label: '5GB' },
                          { size: 10, label: '10GB' },
                        ]
                        
                        for (const sizeInfo of sizes) {
                          // プランの最大サイズを超える場合は表示しない
                          const maxSize = Math.max(maxAudioFileSize || 0, maxVideoFileSize || 0)
                          if (maxSize === 0 || sizeInfo.size * 1024 * 1024 * 1024 > maxSize) {
                            continue
                          }
                          
                          const isEven = rows.length % 2 === 0
                          rows.push(
                            <tr key={sizeInfo.size} className={isEven ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-700 font-bold text-xs sm:text-sm border-b border-slate-200">{sizeInfo.label}</td>
                              <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-slate-200 ${
                                maxVideoFileSize > 0 && sizeInfo.size * 1024 * 1024 * 1024 <= maxVideoFileSize
                                  ? 'text-slate-700 font-medium bg-emerald-50'
                                  : 'text-slate-400 bg-slate-100'
                              }`}>
                                {maxVideoFileSize > 0 && sizeInfo.size * 1024 * 1024 * 1024 <= maxVideoFileSize ? (
                                  <span className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>約{(() => {
                                      // より正確な処理時間の計算（動画ファイル）
                                      const fileSizeMB = sizeInfo.size * 1024
                                      const fileSizeGB = sizeInfo.size
                                      
                                      // アップロード時間（チャンクアップロード）
                                      const totalChunks = Math.ceil((sizeInfo.size * 1024 * 1024 * 1024) / (4 * 1024 * 1024))
                                      const chunkTime = totalChunks * 1.5 // チャンクあたり1.5秒
                                      const mergeTime = Math.max(3, sizeInfo.size * 2) // 結合時間
                                      const uploadTime = (chunkTime + mergeTime) / 60
                                      
                                      // 音声長の推定: 1GB ≈ 1時間（一般的な1080p動画）
                                      const audioLengthMinutes = fileSizeGB * 60
                                      
                                      // 音声抽出時間（FFmpeg）: 1分の動画 ≈ 約8秒
                                      const extractionTime = (audioLengthMinutes * 8) / 60
                                      
                                      // 文字起こし時間（音声長の30%）
                                      const transcriptionTime = audioLengthMinutes * 0.3
                                      
                                      // 構成案生成時間（1000文字あたり12秒）
                                      const textLength = audioLengthMinutes * 1000
                                      const outlineTime = (textLength / 1000) * 12 / 60
                                      
                                      // 記事生成時間（1000文字あたり25秒）
                                      const articleTime = (textLength / 1000) * 25 / 60
                                      
                                      // バッファ時間
                                      const bufferTime = 3 // 3分
                                      
                                      const totalMinutes = uploadTime + extractionTime + transcriptionTime + outlineTime + articleTime + bufferTime
                                      const minMinutes = Math.max(1, Math.floor(totalMinutes * 0.8)) // 最小値（80%）、最低1分
                                      const maxMinutes = Math.ceil(totalMinutes * 1.2) // 最大値（120%）
                                      
                                      return `${minMinutes}-${maxMinutes}分`
                                    })()}</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <X className="w-4 h-4 text-red-500" />
                                    <span className="line-through">利用不可</span>
                                  </span>
                                )}
                              </td>
                              <td className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-slate-200 ${
                                sizeInfo.size * 1024 * 1024 * 1024 <= maxAudioFileSize
                                  ? 'text-slate-700 font-medium bg-emerald-50'
                                  : 'text-slate-400 bg-slate-100'
                              }`}>
                                {sizeInfo.size * 1024 * 1024 * 1024 <= maxAudioFileSize ? (
                                  <span className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>約{(() => {
                                      // より正確な処理時間の計算（音声ファイル）
                                      const fileSizeMB = sizeInfo.size * 1024
                                      
                                      // アップロード時間（チャンクアップロード）
                                      const totalChunks = Math.ceil((sizeInfo.size * 1024 * 1024 * 1024) / (4 * 1024 * 1024))
                                      const chunkTime = totalChunks * 1.2 // チャンクあたり1.2秒（音声は動画より速い）
                                      const mergeTime = Math.max(2, sizeInfo.size * 1.5) // 結合時間
                                      const uploadTime = (chunkTime + mergeTime) / 60
                                      
                                      // 音声長の推定: MP3 (128kbps) 1MB ≈ 約1.08分
                                      const audioLengthMinutes = fileSizeMB * 1.08
                                      
                                      // 文字起こし時間（音声長の30%）
                                      const transcriptionTime = audioLengthMinutes * 0.3
                                      
                                      // 構成案生成時間（1000文字あたり12秒）
                                      const textLength = audioLengthMinutes * 1000
                                      const outlineTime = (textLength / 1000) * 12 / 60
                                      
                                      // 記事生成時間（1000文字あたり25秒）
                                      const articleTime = (textLength / 1000) * 25 / 60
                                      
                                      // バッファ時間
                                      const bufferTime = 2 // 2分（音声は動画より短い）
                                      
                                      const totalMinutes = uploadTime + transcriptionTime + outlineTime + articleTime + bufferTime
                                      const minMinutes = Math.max(1, Math.floor(totalMinutes * 0.8)) // 最小値（80%）、最低1分
                                      const maxMinutes = Math.ceil(totalMinutes * 1.2) // 最大値（120%）
                                      
                                      return `${minMinutes}-${maxMinutes}分`
                                    })()}</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <X className="w-4 h-4 text-red-500" />
                                    <span className="line-through">利用不可</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        }
                        
                        return rows.length > 0 ? rows : (
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-center text-slate-500 text-sm">
                              現在のプランでは利用可能なサイズがありません
                            </td>
                          </tr>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
                {maxVideoFileSize > 0 ? (
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-l-4 border-emerald-500">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-lg">💡</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 mb-1">おすすめ: MP3（音声）に変換してからアップロード</p>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          動画ファイルをMP3などの音声ファイルに変換してからアップロードすると、処理時間が大幅に短縮されます。
                          <br />
                          動画ファイルは音声抽出に時間がかかりますが、音声ファイル（MP3）なら直接処理できるため、より早く完了します。
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100 rounded-xl border-2 border-orange-400 shadow-md">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md">
                        <AlertCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-black text-slate-900 mb-2">動画ファイルのアップロードについて</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed mb-3">
                          現在のプラン（<span className="font-black text-orange-600">{planLimits.planName}</span>）では動画ファイルのアップロードはできません。
                          <br />
                          動画ファイルをアップロードするには、PROプランまたはEnterpriseプランにアップグレードしてください。
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href="/interview/plan"
                            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-black rounded-lg shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2"
                          >
                            <Crown className="w-4 h-4" />
                            プランを確認・アップグレード
                          </Link>
                        </div>
                        <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-orange-200">
                          💡 <span className="font-black">代替案:</span> 動画から音声を抽出してMP3形式でアップロードすることも可能です。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {[
                  { 
                    icon: Music, 
                    label: '音声ファイル', 
                    formats: 'MP3, WAV, M4A', 
                    color: 'from-purple-500 to-pink-500',
                    enabled: true,
                    maxSize: formatFileSizeDisplay(maxAudioFileSize),
                  },
                  { 
                    icon: Video, 
                    label: '動画ファイル', 
                    formats: 'MP4, MOV, AVI', 
                    color: maxVideoFileSize > 0 ? 'from-blue-500 to-cyan-500' : 'from-gray-400 to-gray-500',
                    enabled: maxVideoFileSize > 0,
                    maxSize: maxVideoFileSize > 0 ? formatFileSizeDisplay(maxVideoFileSize) : '不可',
                  },
                  { 
                    icon: FileText, 
                    label: 'テキスト', 
                    formats: 'TXT, DOCX', 
                    color: 'from-emerald-500 to-teal-500',
                    enabled: true,
                    maxSize: '無制限',
                  },
                  { 
                    icon: File, 
                    label: 'PDF', 
                    formats: 'PDF', 
                    color: 'from-red-500 to-orange-500',
                    enabled: true,
                    maxSize: '無制限',
                  },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 shadow-sm hover:shadow-md transition-all ${
                      !item.enabled 
                        ? 'bg-slate-100 border-slate-300 opacity-75' 
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md relative ${
                        !item.enabled ? 'grayscale opacity-50' : ''
                      }`}>
                        <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        {!item.enabled && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <X className="w-8 h-8 text-red-500 opacity-75" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-black mb-1 ${
                          !item.enabled ? 'text-slate-500' : 'text-slate-900'
                        }`}>
                          {item.label}
                        </p>
                        <p className={`text-xs mb-2 ${
                          !item.enabled ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {item.formats}
                        </p>
                        {item.enabled ? (
                          <div className="px-3 py-1 bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg border border-orange-200">
                            <p className="text-xs font-black text-orange-700">
                              最大: {item.maxSize}
                            </p>
                          </div>
                        ) : (
                          <div className="px-3 py-1 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-xs font-black text-red-600 flex items-center justify-center gap-1">
                              <X className="w-3 h-3" />
                              利用不可
                            </p>
                            <p className="text-xs text-red-500 mt-1">PRO以上で利用可能</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-3 text-xl"
              >
                <Upload className="w-7 h-7" />
                ファイルを選択して開始
                <ArrowRight className="w-6 h-6" />
              </motion.button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*,video/*,.pdf,.txt,.docx,.md"
                onChange={handleFileInputChange}
              />
            </div>
          </motion.div>
        )}

        {/* アップロード中・処理中 */}
        {(uploadStatus === 'uploading' ||
          uploadStatus === 'transcribing' ||
          uploadStatus === 'analyzing' ||
          uploadStatus === 'generating') && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl p-12"
          >
            {uploadedFile && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {getFileIcon(materialType)}
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{uploadedFile.name}</h3>
                      <p className="text-sm text-slate-600">{formatFileSize(uploadedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={resetUpload}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    title="キャンセル"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* ステップ表示 */}
              <div className="space-y-4">
                {[
                  { status: 'uploading', label: 'ファイルアップロード', icon: Upload, desc: 'サーバーにアップロード中...' },
                  { status: 'transcribing', label: '文字起こし処理中', icon: FileText, desc: 'AIが音声をテキストに変換中...' },
                  { status: 'analyzing', label: '内容分析・構成案作成', icon: Sparkles, desc: 'AIが内容を分析し構成案を作成中...' },
                  { status: 'generating', label: '記事生成中', icon: Zap, desc: 'AIが記事ドラフトを生成中...' },
                ].map((step, idx) => {
                  const isActive = uploadStatus === step.status
                  const isCompleted =
                    (uploadStatus === 'transcribing' && step.status === 'uploading') ||
                    (uploadStatus === 'analyzing' &&
                      (step.status === 'uploading' || step.status === 'transcribing')) ||
                    (uploadStatus === 'generating' &&
                      ['uploading', 'transcribing', 'analyzing'].includes(step.status)) ||
                    (uploadStatus === 'completed' as UploadStatus)

                  return (
                    <motion.div
                      key={step.status}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-orange-500 bg-orange-50 shadow-md scale-105'
                          : isCompleted
                            ? 'border-green-200 bg-green-50'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : isCompleted
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-7 h-7" />
                        ) : isActive ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : (
                          <step.icon className="w-7 h-7" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-lg font-black ${
                            isActive ? 'text-orange-900' : isCompleted ? 'text-green-900' : 'text-slate-600'
                          }`}
                        >
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-sm text-orange-600 mt-1 font-bold">{step.desc}</p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* 進捗バー */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">処理進捗</span>
                  <span className="font-black text-orange-600 text-lg">{progress}%</span>
                </div>
                <div className="h-5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-full shadow-sm"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 完了 */}
        {uploadStatus === 'completed' && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl border-2 border-green-200 shadow-xl p-12 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500 mb-6 shadow-lg"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-3xl font-black text-green-900 mb-4">🎉 完了しました！</h2>
            <p className="text-lg text-green-700 mb-2">
              記事の生成が完了しました
            </p>
            {errorDetails && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-sm text-yellow-800 font-bold mb-1">⚠️ 一部の処理をスキップしました</p>
                <p className="text-xs text-yellow-700 whitespace-pre-wrap">{errorDetails}</p>
                <p className="text-xs text-yellow-700 mt-2">プロジェクト詳細ページで手動で実行できます。</p>
              </div>
            )}
            <p className="text-sm text-green-600 mt-6">
              プロジェクト詳細ページに移動します...
            </p>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="mt-4"
            >
              <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* クイックアクション */}
      <div className="mt-12 grid md:grid-cols-2 gap-6">
        <Link
          href="/interview/planning"
          className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 mb-1">企画立案</h3>
              <p className="text-sm text-slate-600">AIが複数の企画案と質問リストを提案</p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          href="/interview/projects"
          className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 mb-1">プロジェクト一覧</h3>
              <p className="text-sm text-slate-600">作成したプロジェクトを管理</p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* 環境変数確認リンク */}
      <div className="mt-8 text-center">
        <Link
          href="/interview/check-env"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-orange-500 bg-white rounded-lg border border-slate-200 hover:border-orange-300 transition-all"
        >
          <AlertCircle className="w-4 h-4" />
          環境変数の設定を確認
        </Link>
      </div>

      {/* ヘルプ */}
      <div className="mt-12 p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-orange-900 mb-2">使い方</h3>
            <ol className="text-sm text-orange-800 leading-relaxed space-y-1">
              <li>1. 音声・動画・テキストファイルをドラッグ&ドロップまたはクリックで選択</li>
              <li>2. 自動で文字起こし・内容分析が実行されます（数分かかる場合があります）</li>
              <li>3. AIが構成案を作成し、記事ドラフトを生成</li>
              <li>4. プロジェクト詳細ページで編集・校閲・出力</li>
            </ol>
            <div className="mt-4 p-3 bg-white/50 rounded-lg border border-orange-200">
              <p className="text-xs font-black text-orange-900 mb-1">💡 対応ファイル形式</p>
              <p className="text-xs text-orange-700">
                音声: MP3, WAV, M4A, AAC, OGG / 動画: MP4, MOV, AVI, WebM / テキスト: TXT, DOCX, MD / PDF: PDF
              </p>
              <p className="text-xs text-orange-700 mt-1">
                最大ファイルサイズ: <span className="font-black">1GB（1,000MB）</span>
                <br />
                <span className="text-[10px] text-orange-600">
                  ※ 文字起こし機能を使用するため、1GBまでアップロード可能です
                  <br />
                  クライアントから直接Google Cloud Storageにアップロードします
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
