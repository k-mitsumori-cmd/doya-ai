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
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PartyLoadingOverlay, type OverlayMood } from '@/components/persona/PersonaMotion'

type UploadStatus = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'completed' | 'error'
type MaterialType = 'audio' | 'video' | 'text' | 'pdf' | null

// Vercel Blob Storageを使用したアップロード
// - Vercel Blob Storageの上限: 4.75GB
// - チャンクアップロードを使用することで、大きなファイルもアップロード可能
// - 4.5MBを超えるファイルは自動的にチャンクアップロードを使用（Vercelのサーバーレス関数制限）
const MAX_FILE_SIZE = 4.75 * 1024 * 1024 * 1024 // 4.75GB（Vercel Blob Storageの上限）
const VERCEL_LIMIT = 4.5 * 1024 * 1024 // 4.5MB（Vercelのサーバーレス関数のリクエストボディサイズ制限）
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB（チャンクサイズ - Vercelの制限より少し小さく）
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

    // beforeunloadイベントでページ遷移を防止
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'アップロード中です。ページを離れるとアップロードが中断されます。'
      return e.returnValue
    }

    // ルーター遷移を防止するためのカスタムイベント
    const handleRouteChange = (e: PopStateEvent) => {
      if (isUploading) {
        e.preventDefault()
        if (window.confirm('アップロード中です。ページを離れるとアップロードが中断されます。本当に離れますか？')) {
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
        if (!window.confirm('アップロード中です。ページを離れるとアップロードが中断されます。本当に離れますか？')) {
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

  const validateFile = (file: File): { valid: boolean; error?: string; details?: string; useChunk?: boolean } => {
    // ファイルサイズチェック（4.75GBまでVercel Blob Storageで対応可能）
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeGB = (file.size / 1024 / 1024 / 1024).toFixed(2)
      const maxSizeGB = (MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)
      return {
        valid: false,
        error: 'ファイルサイズが大きすぎます',
        details: `最大ファイルサイズ: ${maxSizeGB}GB（MAX）\n現在のファイルサイズ: ${formatFileSize(file.size)}（${fileSizeGB}GB > ${maxSizeGB}GB）\n\n${maxSizeGB}GBを超えるファイルはアップロードできません。ファイルを分割するか、より小さなファイルサイズに圧縮してください。`,
      }
    }
    
    // 4.5MBを超える場合はチャンクアップロードを使用（Vercelのサーバーレス関数制限）
    if (file.size > VERCEL_LIMIT) {
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

    // ファイルタイプチェック
    const mimeType = file.type
    const fileName = file.name.toLowerCase()
    const extension = fileName.split('.').pop()

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
            const errorData = await response.json().catch(() => ({}))
            const errorMsg = errorData.error || `チャンク ${chunkIndex + 1}/${totalChunks} のアップロードに失敗しました`
            const errorDetails = errorData.details || ''
            throw new Error(`${errorMsg}${errorDetails ? `\n${errorDetails}` : ''}`)
          }

          const result = await response.json()
          lastResult = result

          console.log(`[CHUNK] Chunk ${chunkIndex + 1}/${totalChunks} uploaded. Completed: ${result.completed}, Progress: ${result.uploadedChunks || uploadedChunks + 1}/${result.totalChunks || totalChunks}`)

          // 進捗を更新
          uploadedChunks++
          const chunkProgress = Math.round((uploadedChunks / totalChunks) * 100)
          setProgress(30 + Math.round((chunkProgress * 20) / 100)) // 30%から50%の間で進捗表示

          // すべてのチャンクがアップロード完了（最後のチャンクの場合）
          if (result.completed && result.material) {
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
                  const checkResult = await checkRes.json()
                  if (checkResult.completed && checkResult.material) {
                    console.log(`[CHUNK] Merge completed after wait. Material ID: ${checkResult.material.id}`)
                    return checkResult
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
          retryCount++
          console.error(`[CHUNK] Chunk ${chunkIndex + 1}/${totalChunks} upload failed (attempt ${retryCount}/${maxRetries}):`, error)
          
          if (retryCount >= maxRetries) {
            const errorMessage = error instanceof Error ? error.message : '不明なエラー'
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
    if (lastResult && lastResult.completed && lastResult.material) {
      console.log(`[CHUNK] Upload completed from last result. Material ID: ${lastResult.material.id}`)
      return lastResult
    }

    // すべてのチャンクをアップロードしたが、完了レスポンスが返ってこなかった場合
    // 最後のチャンクを再度送信して、完了状態を確認（サーバー側でファイル結合が完了するまで少し待機）
    console.log(`[CHUNK] All chunks uploaded, waiting for server to complete file merge...`)
    
    // 最初に少し待機（結合処理が開始される時間を確保）
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    for (let waitAttempt = 0; waitAttempt < 20; waitAttempt++) {
      await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒待機
      
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
          const checkResult = await checkResponse.json()
          if (checkResult.completed && checkResult.material) {
            console.log(`[CHUNK] Upload completed after wait (attempt ${waitAttempt + 1}). Material ID: ${checkResult.material.id}`)
            return checkResult
          }
        }
      } catch (checkError) {
        console.error(`[CHUNK] Wait attempt ${waitAttempt + 1} failed:`, checkError)
      }
    }

    throw new Error(`ファイルのアップロードが完了しませんでした。\nアップロードしたチャンク数: ${uploadedChunks}/${totalChunks}\nサーバー側でファイルの結合が完了していない可能性があります。しばらく待ってから再度お試しください。`)
  }

  const handleFileSelect = async (file: File) => {
    // エラーメッセージをクリア
    setErrorMessage(null)
    setErrorDetails(null)

    // ファイル検証
    const validation = validateFile(file)
    if (!validation.valid) {
      setErrorMessage(validation.error || 'ファイルの検証に失敗しました')
      setErrorDetails(validation.details)
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

      // 2. ファイルアップロード（チャンクアップロード or 通常アップロード）
      let uploadData
      // 4.5MBを超える場合はチャンクアップロードを使用（Vercelのサーバーレス関数制限）
      if (file.size > VERCEL_LIMIT) {
        console.log(`[INTERVIEW] Using chunk upload for file size: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
        uploadData = await uploadFileInChunks(file, newProjectId, guestId)
      } else {
        // 4.5MB以下の場合は通常アップロード
        console.log(`[INTERVIEW] Using normal upload for file size: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
        const formData = new FormData()
        formData.append('projectId', newProjectId)
        formData.append('file', file)

        let uploadRes
        try {
          uploadRes = await fetch('/api/interview/materials/upload', {
            method: 'POST',
            headers: {
              ...(guestId ? { 'x-guest-id': guestId } : {}),
            },
            body: formData,
          })
        } catch (error) {
          throw new Error('ファイルのアップロードに失敗しました。\nネットワークエラーが発生しました。インターネット接続を確認してください。')
        }

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}))
          const errorMsg = errorData.error || 'ファイルアップロードに失敗しました'
          const errorDetails = errorData.details || 'ファイル形式やサイズを確認してください。'
          
          // チャンクアップロードが必要な場合は自動的にリダイレクト
          if (errorData.useChunkUpload) {
            console.log(`[INTERVIEW] Server requested chunk upload, switching to chunk upload...`)
            uploadData = await uploadFileInChunks(file, newProjectId, guestId)
          } else {
            throw new Error(`${errorMsg}\n${errorDetails}`)
          }
        } else {
          uploadData = await uploadRes.json()
          if (!uploadData.material?.id) {
            throw new Error('アップロードしたファイルの情報を取得できませんでした。\nサーバーからの応答が不正です。もう一度お試しください。')
          }
        }
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
          const transcribeRes = await fetch('/api/interview/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: newProjectId,
              materialId: uploadData.material.id,
            }),
          })

          if (!transcribeRes.ok) {
            console.warn('文字起こしに失敗しました（スキップ）')
            setErrorDetails('文字起こし処理をスキップしました。後で手動で実行できます。')
          } else {
            const transcribeData = await transcribeRes.json()
            transcriptionId = transcribeData.transcription?.id
          }
        } catch (error) {
          console.warn('文字起こしエラー:', error)
          setErrorDetails('文字起こし処理でエラーが発生しましたが、続行します。')
        }
        setProgress(75)
      } else if (type === 'text' || type === 'pdf') {
        // テキスト・PDFの場合は抽出テキストを使用
        setProgress(75)
      }

      // 4. 分析・構成案生成
      setUploadStatus('analyzing')
      setProgress(80)

      try {
        const outlineRes = await fetch('/api/interview/outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProjectId,
          }),
        })

        if (!outlineRes.ok) {
          console.warn('構成案生成に失敗しました（スキップ）')
          setErrorDetails((prev) => (prev ? prev + '\n構成案生成をスキップしました。' : '構成案生成をスキップしました。'))
        } else {
          setProgress(90)
        }
      } catch (error) {
        console.warn('構成案生成エラー:', error)
        setErrorDetails((prev) => (prev ? prev + '\n構成案生成でエラーが発生しました。' : '構成案生成でエラーが発生しました。'))
      }

      // 5. 記事生成
      setUploadStatus('generating')
      setProgress(92)

      try {
        const draftRes = await fetch('/api/interview/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProjectId,
          }),
        })

        if (!draftRes.ok) {
          console.warn('記事生成に失敗しました（後で手動で生成可能）')
          setErrorDetails((prev) => (prev ? prev + '\n記事生成をスキップしました。後で手動で実行できます。' : '記事生成をスキップしました。後で手動で実行できます。'))
        } else {
          setProgress(98)
        }
      } catch (error) {
        console.warn('記事生成エラー:', error)
        setErrorDetails((prev) => (prev ? prev + '\n記事生成でエラーが発生しました。' : '記事生成でエラーが発生しました。'))
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
      const errorLines = errorMsg.split('\n')
      const mainError = errorLines[0] || 'エラーが発生しました'
      const errorDetailsText = errorLines.slice(1).join('\n') || '詳細なエラー情報はコンソールを確認してください。問題が続く場合は、サポートにお問い合わせください。'
      
      setErrorMessage(mainError)
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
      />
      {/* ヒーローセクション */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 mb-6 shadow-2xl shadow-orange-500/30"
        >
          <Rocket className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
          <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            ファイルをアップロードするだけ
          </span>
          <br />
          <span className="text-slate-900">AIが自動で記事を生成</span>
        </h1>
        <p className="text-lg text-slate-600 mb-4 max-w-2xl mx-auto">
          音声・動画・テキストをアップロードするだけで、<br />
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
            className="mb-6 p-6 bg-red-50 border-2 border-red-200 rounded-2xl shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-red-900 mb-2">{errorMessage}</h3>
                {errorDetails && (
                  <div className="text-sm text-red-700 whitespace-pre-wrap bg-red-100/50 p-3 rounded-lg border border-red-200">
                    {errorDetails}
                  </div>
                )}
                <button
                  onClick={resetUpload}
                  className="mt-4 px-4 py-2 bg-red-600 text-white font-black rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  やり直す
                </button>
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
            className={`bg-white rounded-3xl border-2 ${
              isDragging ? 'border-orange-500 bg-orange-50' : 'border-dashed border-slate-300'
            } shadow-xl p-12 transition-all`}
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
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 mb-6 shadow-lg">
                  <Upload className="w-16 h-16 text-orange-500" />
                </div>
              </motion.div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">
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
              <p className="text-slate-600 mb-2 text-lg">
                またはクリックしてファイルを選択
              </p>
              <p className="text-sm text-slate-500 mb-6">
                最大ファイルサイズ: <span className="font-black text-orange-600">4.75GB（MAX）</span>
                <br />
                <span className="text-xs text-slate-400">
                  ※ 4.5MB以上のファイルは自動的にチャンクアップロードで処理されます
                  <br />
                  ※ Vercel Blob Storageを使用してアップロードされます
                </span>
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { icon: Music, label: '音声ファイル', formats: 'MP3, WAV, M4A', color: 'from-purple-500 to-pink-500' },
                  { icon: Video, label: '動画ファイル', formats: 'MP4, MOV, AVI', color: 'from-blue-500 to-cyan-500' },
                  { icon: FileText, label: 'テキスト', formats: 'TXT, DOCX', color: 'from-emerald-500 to-teal-500' },
                  { icon: File, label: 'PDF', formats: 'PDF', color: 'from-red-500 to-orange-500' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md`}>
                        <item.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-slate-900 mb-1">{item.label}</p>
                        <p className="text-xs text-slate-600">{item.formats}</p>
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
                    uploadStatus === 'completed'

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
                最大ファイルサイズ: <span className="font-black">4.75GB（MAX）</span>
                <br />
                <span className="text-[10px] text-orange-600">
                  4.5MB以上はチャンクアップロードで自動処理（Vercel Blob Storage使用）
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
