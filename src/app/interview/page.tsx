'use client'

import { useState, useCallback, useRef } from 'react'
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
  Play,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type UploadStatus = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'completed'
type MaterialType = 'audio' | 'video' | 'text' | 'pdf' | null

export default function InterviewPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [materialType, setMaterialType] = useState<MaterialType>(null)

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
  }, [])

  const handleFileSelect = async (file: File) => {
    // ファイルタイプ判定
    let type: MaterialType = null
    if (file.type.startsWith('audio/')) type = 'audio'
    else if (file.type.startsWith('video/')) type = 'video'
    else if (file.type === 'application/pdf') type = 'pdf'
    else if (file.type.startsWith('text/')) type = 'text'

    if (!type) {
      alert('対応していないファイル形式です。音声・動画・テキスト・PDFファイルをアップロードしてください。')
      return
    }

    setUploadedFile(file)
    setMaterialType(type)
    await startUploadProcess(file, type)
  }

  const startUploadProcess = async (file: File, type: MaterialType) => {
    try {
      // 1. プロジェクト作成
      setUploadStatus('uploading')
      setProgress(10)

      const projectRes = await fetch('/api/interview/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ''),
          status: 'UPLOADING',
        }),
      })

      if (!projectRes.ok) throw new Error('プロジェクト作成に失敗しました')
      const projectData = await projectRes.json()
      const newProjectId = projectData.project.id
      setProjectId(newProjectId)
      setProgress(30)

      // 2. ファイルアップロード
      const formData = new FormData()
      formData.append('projectId', newProjectId)
      formData.append('file', file)

      const uploadRes = await fetch('/api/interview/materials/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) throw new Error('ファイルアップロードに失敗しました')
      const uploadData = await uploadRes.json()
      setProgress(50)

      // 3. 文字起こし（音声・動画の場合）
      let transcriptionId = null
      if (type === 'audio' || type === 'video') {
        setUploadStatus('transcribing')
        setProgress(60)

        const transcribeRes = await fetch('/api/interview/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProjectId,
            materialId: uploadData.material.id,
          }),
        })

        if (!transcribeRes.ok) throw new Error('文字起こしに失敗しました')
        const transcribeData = await transcribeRes.json()
        transcriptionId = transcribeData.transcription?.id
        setProgress(75)
      } else if (type === 'text' || type === 'pdf') {
        // テキスト・PDFの場合は抽出テキストを使用
        setProgress(75)
      }

      // 4. 分析・構成案生成
      setUploadStatus('analyzing')
      setProgress(80)

      const outlineRes = await fetch('/api/interview/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: newProjectId,
        }),
      })

      if (!outlineRes.ok) {
        console.warn('構成案生成に失敗しました（スキップ）')
      } else {
        setProgress(90)
      }

      // 5. 記事生成
      setUploadStatus('generating')
      setProgress(92)

      const draftRes = await fetch('/api/interview/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: newProjectId,
        }),
      })

      if (!draftRes.ok) {
        console.warn('記事生成に失敗しました（後で手動で生成可能）')
      } else {
        setProgress(98)
      }

      // 完了
      setUploadStatus('completed')
      setProgress(100)

      // プロジェクト詳細ページに遷移
      setTimeout(() => {
        router.push(`/interview/projects/${newProjectId}`)
      }, 1500)
    } catch (error) {
      console.error('Upload process error:', error)
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
      setUploadStatus('idle')
      setProgress(0)
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

  return (
    <div className="max-w-6xl mx-auto">
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
          <Upload className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
          素材をアップロード
        </h1>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
          音声・動画・テキストをアップロードするだけで、自動で文字起こし・記事生成まで完了します
        </p>
      </motion.div>

      {/* アップロードエリア */}
      <AnimatePresence mode="wait">
        {uploadStatus === 'idle' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-3xl border-2 border-dashed border-slate-300 shadow-xl p-12"
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
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 mb-6">
                  <Upload className="w-16 h-16 text-orange-500" />
                </div>
              </motion.div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                {isDragging ? 'ここにドロップしてください' : 'ファイルをドラッグ&ドロップ'}
              </h2>
              <p className="text-slate-600 mb-6">
                またはクリックしてファイルを選択
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {[
                  { icon: Music, label: '音声', formats: 'MP3, WAV, M4A' },
                  { icon: Video, label: '動画', formats: 'MP4, MOV, AVI' },
                  { icon: FileText, label: 'テキスト', formats: 'TXT, DOCX' },
                  { icon: File, label: 'PDF', formats: 'PDF' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="w-5 h-5 text-orange-500" />
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.formats}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-3 text-lg"
              >
                <Upload className="w-6 h-6" />
                ファイルを選択
              </motion.button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*,video/*,.pdf,.txt,.docx"
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
                  { status: 'uploading', label: 'ファイルアップロード', icon: Upload },
                  { status: 'transcribing', label: '文字起こし処理中', icon: FileText },
                  { status: 'analyzing', label: '内容分析・構成案作成', icon: Sparkles },
                  { status: 'generating', label: '記事生成中', icon: Zap },
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
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        isActive
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : isCompleted
                            ? 'border-green-200 bg-green-50'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : isCompleted
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : isActive ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <step.icon className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`font-black ${
                            isActive ? 'text-orange-900' : isCompleted ? 'text-green-900' : 'text-slate-600'
                          }`}
                        >
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-sm text-orange-600 mt-1">処理中...</p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* 進捗バー */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">進捗</span>
                  <span className="font-black text-orange-600">{progress}%</span>
                </div>
                <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-600 rounded-full shadow-sm"
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
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500 mb-6"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h2 className="text-3xl font-black text-green-900 mb-4">完了しました！</h2>
            <p className="text-lg text-green-700 mb-8">
              記事の生成が完了しました。プロジェクト詳細ページに移動します...
            </p>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
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
              <li>2. 自動で文字起こし・内容分析が実行されます</li>
              <li>3. AIが構成案を作成し、記事ドラフトを生成</li>
              <li>4. プロジェクト詳細ページで編集・校閲・出力</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
