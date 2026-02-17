'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import InterviewUpsellModal from '@/components/interview/InterviewUpsellModal'

interface Project {
  id: string
  title: string
  status: string
  intervieweeName: string | null
  genre: string | null
  thumbnailUrl?: string | null
  materialCount: number
  draftCount: number
  articleTitle?: string | null
  articleSummary?: string | null
  transcriptionSummary?: string | null
  transcriptionExcerpt?: string | null
  createdAt: string
  updatedAt: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'creating' | 'uploading' | 'confirming' | 'transcribing' | 'done' | 'error'
  error?: string
  errorActionUrl?: string
  errorActionLabel?: string
  materialId?: string
  projectId?: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600 border border-slate-200' },
  PLANNING: { label: '企画中', color: 'bg-purple-50 text-purple-600 border border-purple-200' },
  TRANSCRIBING: { label: '処理中', color: 'bg-amber-50 text-amber-600 border border-amber-200' },
  EDITING: { label: '編集中', color: 'bg-blue-50 text-blue-600 border border-blue-200' },
  REVIEWING: { label: 'レビュー中', color: 'bg-indigo-50 text-indigo-600 border border-indigo-200' },
  COMPLETED: { label: '完了', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
}

const GENRE_COLORS: Record<string, string> = {
  CASE_STUDY: 'from-blue-400 to-indigo-500',
  PRODUCT_INTERVIEW: 'from-emerald-400 to-teal-500',
  PERSONA_INTERVIEW: 'from-violet-400 to-purple-500',
  PANEL_DISCUSSION: 'from-amber-400 to-orange-500',
  EVENT_REPORT: 'from-rose-400 to-pink-500',
  OTHER: 'from-slate-400 to-slate-500',
}

const pageVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const UPLOAD_STEPS = [
  { key: 'creating', label: 'プロジェクト作成', icon: 'folder_open', activeIcon: 'create_new_folder' },
  { key: 'uploading', label: 'アップロード中', icon: 'cloud_upload', activeIcon: 'cloud_sync' },
  { key: 'confirming', label: '確認処理', icon: 'verified', activeIcon: 'pending' },
  { key: 'transcribing', label: '文字起こし開始', icon: 'mic', activeIcon: 'graphic_eq' },
  { key: 'done', label: '完了', icon: 'check_circle', activeIcon: 'celebration' },
]

const UPLOAD_TIPS = [
  { icon: 'auto_awesome', text: 'AI文字起こしは95%以上の精度で音声をテキスト化します', emoji: '✨' },
  { icon: 'speed', text: '30分の音声でも約1〜2分で文字起こしが完了します（1回最大約3時間）', emoji: '⚡' },
  { icon: 'mic', text: '複数の話者がいても、AIが自動で話者を分離します', emoji: '🎙️' },
  { icon: 'article', text: '文字起こし結果からプロ品質の記事を自動生成します', emoji: '📝' },
  { icon: 'edit_note', text: '生成された記事はエディタで自由に編集できます', emoji: '✏️' },
  { icon: 'fact_check', text: 'ファクトチェック機能で信頼性を自動検証します', emoji: '🔍' },
  { icon: 'share', text: 'SNS投稿文の自動生成で、記事の拡散も簡単です', emoji: '🚀' },
  { icon: 'translate', text: '10言語への翻訳機能で、グローバル展開も対応', emoji: '🌐' },
]

const FLOATING_EMOJIS = ['🎙️', '📝', '✨', '🎬', '🎵', '💡', '⚡', '🔥', '🚀', '💜']

export default function InterviewDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const userName = (session?.user?.name || '').split(' ')[0] || 'ゲスト'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadSpeedRef = useRef<Map<string, { startTime: number; lastLoaded: number; speed: number }>>(new Map())

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map())
  const [tipIndex, setTipIndex] = useState(0)

  // アップセルモーダル
  const [upsellOpen, setUpsellOpen] = useState(false)
  const [upsellLimitType, setUpsellLimitType] = useState<'transcription' | 'upload' | 'generation'>('generation')
  const [upsellIsGuest, setUpsellIsGuest] = useState(false)

  // プロジェクト一覧取得（ログインユーザーのみ）
  useEffect(() => {
    if (!session?.user) {
      setLoading(false)
      return
    }
    fetch('/api/interview/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProjects(data.projects || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session])

  // 豆知識サイクル — uploads.size でシンプルに判定
  const uploadsExist = uploads.size > 0

  useEffect(() => {
    if (!uploadsExist) return
    const interval = setInterval(() => setTipIndex((i) => (i + 1) % UPLOAD_TIPS.length), 4000)
    return () => clearInterval(interval)
  }, [uploadsExist])

  // ブラウザ離脱防止
  useEffect(() => {
    if (!uploadsExist) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploadsExist])

  const recentProjects = projects.slice(0, 6)

  // ファイルからプロジェクト名を生成
  const getProjectTitle = (file: File) => {
    const name = file.name.replace(/\.[^/.]+$/, '')
    return name.replace(/[_-]/g, ' ').trim() || '新規インタビュー'
  }

  // ダッシュボードからのアップロード: プロジェクト自動作成 → アップロード → 文字起こし
  const uploadFromDashboard = useCallback(async (file: File) => {
    const uploadKey = `${file.name}_${Date.now()}`
    const title = getProjectTitle(file)

    setUploads((prev) => {
      const next = new Map(prev)
      next.set(uploadKey, { file, progress: 0, status: 'creating' })
      return next
    })

    try {
      // Step 1: プロジェクト自動作成
      const projectRes = await fetch('/api/interview/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const projectData = await projectRes.json()
      if (!projectData.success) {
        if (projectRes.status === 429) {
          setUpsellLimitType('generation')
          setUpsellIsGuest(projectData.code === 'GUEST_LIMIT')
          setUpsellOpen(true)
        }
        throw new Error(projectData.error || 'プロジェクト作成失敗')
      }

      const projectId = projectData.project.id

      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'uploading', projectId })
        return next
      })

      // Step 2: 署名付きURL取得
      const urlRes = await fetch('/api/interview/materials/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      })
      const urlData = await urlRes.json()
      if (!urlData.success) {
        if (urlData.code === 'GUEST_UPLOAD_LIMIT' || urlData.code === 'PLAN_UPLOAD_LIMIT') {
          setUpsellLimitType('upload')
          setUpsellIsGuest(urlData.code === 'GUEST_UPLOAD_LIMIT')
          setUpsellOpen(true)
        }
        const err: any = new Error(urlData.error || 'アップロードURL取得失敗')
        err.actionUrl = urlData.actionUrl
        err.actionLabel = urlData.actionLabel
        throw err
      }

      const { signedUrl, materialId } = urlData

      // Step 3: Supabase Storage へ直接PUT (リトライ付き)
      const maxRetries = 3
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100)
                // 速度計算
                const speedInfo = uploadSpeedRef.current.get(uploadKey)
                if (speedInfo) {
                  const elapsed = (Date.now() - speedInfo.startTime) / 1000
                  if (elapsed > 0) {
                    speedInfo.speed = e.loaded / elapsed
                    speedInfo.lastLoaded = e.loaded
                  }
                } else {
                  uploadSpeedRef.current.set(uploadKey, { startTime: Date.now(), lastLoaded: e.loaded, speed: 0 })
                }
                setUploads((prev) => {
                  const next = new Map(prev)
                  const item = next.get(uploadKey)
                  if (item) next.set(uploadKey, { ...item, progress, materialId })
                  return next
                })
              }
            })

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve()
              } else {
                const errMsg = xhr.responseText || ''
                reject(new Error(`Upload failed: ${xhr.status}${errMsg ? ` - ${errMsg.slice(0, 200)}` : ''}`))
              }
            })
            xhr.addEventListener('error', () => reject(new Error('ネットワークエラー')))
            xhr.addEventListener('abort', () => reject(new Error('アップロードが中断されました')))

            const formData = new FormData()
            formData.append('cacheControl', '3600')
            formData.append('', file, file.name)
            xhr.open('PUT', signedUrl)
            xhr.setRequestHeader('x-upsert', 'true')
            xhr.send(formData)
          })
          break // 成功したらループを抜ける
        } catch (uploadErr: any) {
          const is5xx = /Upload failed: 5\d\d/.test(uploadErr?.message || '')
          if (is5xx && attempt < maxRetries) {
            console.warn(`[interview] Upload attempt ${attempt} failed (${uploadErr.message}), retrying in ${attempt * 3}s...`)
            // プログレスをリセットして再試行
            setUploads((prev) => {
              const next = new Map(prev)
              const item = next.get(uploadKey)
              if (item) next.set(uploadKey, { ...item, progress: 0 })
              return next
            })
            uploadSpeedRef.current.delete(uploadKey)
            await new Promise(r => setTimeout(r, attempt * 3000))
            continue
          }
          throw uploadErr
        }
      }

      // Step 4: アップロード確認
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'confirming', progress: 100 })
        return next
      })

      const confirmRes = await fetch('/api/interview/materials/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmData.success) throw new Error(confirmData.error || '確認処理失敗')

      // Step 5: 音声/動画ならリアルタイム文字起こしページへ遷移
      const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/')
      if (isAudioVideo && materialId) {
        setUploads((prev) => {
          const next = new Map(prev)
          const item = next.get(uploadKey)
          if (item) next.set(uploadKey, { ...item, status: 'done' })
          return next
        })

        // リアルタイム文字起こしページへ遷移
        router.push(`/interview/projects/${projectId}/transcribe?materialId=${materialId}`)
        return
      }

      // 完了
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'done' })
        return next
      })

      // プロジェクト一覧を更新
      const refreshRes = await fetch('/api/interview/projects')
      const refreshData = await refreshRes.json()
      if (refreshData.success) setProjects(refreshData.projects || [])

      // 5秒後にアップロード表示を消す
      setTimeout(() => {
        setUploads((prev) => {
          const next = new Map(prev)
          next.delete(uploadKey)
          return next
        })
      }, 5000)
    } catch (e: any) {
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, {
          ...item,
          status: 'error',
          error: e.message,
          errorActionUrl: e.actionUrl,
          errorActionLabel: e.actionLabel,
        })
        return next
      })
    }
  }, [])

  const handleFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      uploadFromDashboard(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  }

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  const getProjectLink = (p: Project) => {
    if (p.draftCount > 0) return `/interview/projects/${p.id}/edit`
    if (p.materialCount > 0) return `/interview/projects/${p.id}/skill`
    return `/interview/projects/${p.id}/materials`
  }

  const getStatusLabel = (status: string) => {
    if (status === 'TRANSCRIBING' || status === 'PLANNING' || status === 'RECORDING') {
      return { label: '処理中', color: 'bg-amber-50 text-amber-600 border border-amber-200' }
    }
    if (status === 'COMPLETED' || status === 'EDITING' || status === 'REVIEWING') {
      return { label: '完了', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' }
    }
    return STATUS_LABELS[status] || STATUS_LABELS.DRAFT
  }

  return (
    <motion.div
      className="max-w-5xl mx-auto space-y-8"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* Welcome Section */}
      <div className="text-center pt-4 pb-2">
        <motion.h1
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          おかえりなさい、{userName}さん
        </motion.h1>
        <motion.p
          className="text-slate-500 text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          インタビュー素材をアップロードして、AI記事を生成しましょう
        </motion.p>
      </div>

      {/* Upload Zone Card */}
      <motion.div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="p-4 sm:p-8 md:p-12">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-8 sm:py-14 px-4 sm:px-6 transition-all cursor-pointer group ${
              dragOver
                ? 'border-[#7f19e6] bg-[#7f19e6]/10 scale-[1.01]'
                : 'border-[#7f19e6]/25 bg-[#7f19e6]/[0.03] hover:bg-[#7f19e6]/[0.06] hover:border-[#7f19e6]/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4,.mov,.avi,.pdf,.txt,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
              className="hidden"
            />
            <div className="w-14 h-14 bg-[#7f19e6] rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-lg shadow-[#7f19e6]/20">
              <span className="material-symbols-outlined text-white text-3xl">cloud_upload</span>
            </div>
            <h3 className="text-base sm:text-xl font-black text-slate-900 mb-1.5 text-center">インタビュー記事を作成する</h3>
            <p className="text-slate-500 text-xs sm:text-sm mb-6 text-center">
              動画・音声ファイルをドラッグ&ドロップ。MP4, MOV, MP3 最大10GBまで
            </p>
            <span className="bg-[#7f19e6] text-white px-6 sm:px-8 py-3 rounded-xl font-black text-sm hover:bg-[#6b12c9] transition-all shadow-lg shadow-[#7f19e6]/25 inline-flex items-center gap-2 min-h-[44px]">
              <span className="material-symbols-outlined text-lg">add_circle</span>
              ファイルを選択
            </span>
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-4 sm:mt-6">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              <span className="material-symbols-outlined text-[#7f19e6] text-xl">record_voice_over</span>
              <div>
                <p className="text-xs font-black text-slate-900">話者分離</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自動対応</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              <span className="material-symbols-outlined text-[#7f19e6] text-xl">auto_awesome</span>
              <div>
                <p className="text-xs font-black text-slate-900">AI記事下書き</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自動生成</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Upload Progress Modal — createPortal でビューポート直下にレンダリング */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {uploads.size > 0 && (() => {
          const allUploads = Array.from(uploads.entries())
          const activeUploads = allUploads.filter(([, u]) => u.status !== 'done' && u.status !== 'error')
          const doneUploads = allUploads.filter(([, u]) => u.status === 'done')
          const errorUploads = allUploads.filter(([, u]) => u.status === 'error')
          const isAllDone = activeUploads.length === 0 && doneUploads.length > 0

          // 全体の進捗 (各ステップを均等配分: creating=10%, uploading=60%, confirming=80%, transcribing=90%, done=100%)
          const getStepProgress = (u: UploadingFile) => {
            if (u.status === 'creating') return 5
            if (u.status === 'uploading') return 10 + (u.progress * 0.6)
            if (u.status === 'confirming') return 75
            if (u.status === 'transcribing') return 85
            if (u.status === 'done') return 100
            return 0
          }
          const totalProgress = allUploads.length > 0
            ? Math.round(allUploads.reduce((sum, [, u]) => sum + getStepProgress(u), 0) / allUploads.length)
            : 0

          const circumference = 2 * Math.PI * 54
          const strokeDashoffset = circumference - (totalProgress / 100) * circumference

          // 現在のメインステータスを取得
          const primaryUpload = activeUploads[0]?.[1] || doneUploads[0]?.[1]
          const currentStepIndex = primaryUpload ? UPLOAD_STEPS.findIndex(s => s.key === primaryUpload.status) : -1

          return (
          <motion.div
            key="upload-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gradient-to-b from-slate-900/80 via-purple-900/40 to-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            {/* 浮遊エモジ背景 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {FLOATING_EMOJIS.map((emoji, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl opacity-20"
                  style={{
                    left: `${5 + (i * 10) % 90}%`,
                    top: `${10 + (i * 13) % 70}%`,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    x: [0, i % 2 === 0 ? 15 : -15, 0],
                    rotate: [0, i % 2 === 0 ? 20 : -20, 0],
                    scale: [1, 1.3, 1],
                    opacity: [0.15, 0.3, 0.15],
                  }}
                  transition={{
                    duration: 4 + i * 0.6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.3,
                  }}
                >
                  {emoji}
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* グラデーション背景トップ */}
              <div className="relative bg-gradient-to-br from-[#7f19e6] via-[#9b3ae6] to-[#b366f0] px-4 sm:px-6 pt-6 sm:pt-8 pb-5 sm:pb-6 overflow-hidden">
                {/* パーティクル装飾 */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-white/20 rounded-full"
                      style={{
                        left: `${15 + i * 15}%`,
                        top: `${20 + (i * 20) % 60}%`,
                      }}
                      animate={{
                        y: [0, -20, 0],
                        opacity: [0.2, 0.5, 0.2],
                        scale: [1, 1.5, 1],
                      }}
                      transition={{
                        duration: 3 + i * 0.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.4,
                      }}
                    />
                  ))}
                </div>

                <div className="relative flex flex-col items-center">
                  {/* 円形プログレスリング */}
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-4">
                    <svg className="w-28 h-28 sm:w-36 sm:h-36 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                      <motion.circle
                        cx="60" cy="60" r="54" fill="none"
                        stroke="white" strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </svg>
                    {/* パルスリング */}
                    {!isAllDone && (
                      <motion.div
                        className="absolute inset-2 rounded-full border-2 border-white/20"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    {/* 中央 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {isAllDone ? (
                        <motion.span
                          className="text-4xl"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        >
                          🎉
                        </motion.span>
                      ) : (
                        <>
                          <motion.span
                            className="text-3xl font-black text-white tabular-nums leading-none"
                            key={totalProgress}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            {totalProgress}
                          </motion.span>
                          <span className="text-[10px] font-bold text-white/60 mt-0.5">%</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* タイトル */}
                  <AnimatePresence mode="wait">
                    <motion.h3
                      key={isAllDone ? 'done' : 'active'}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-xl font-black text-white mb-1 text-center"
                    >
                      {isAllDone ? 'アップロード完了!' : 'アップロード中...'}
                    </motion.h3>
                  </AnimatePresence>
                  <p className="text-sm text-white/70 font-bold">
                    {isAllDone
                      ? '文字起こしがバックグラウンドで進行中です'
                      : 'このページを離れないでください'}
                  </p>
                </div>
              </div>

              {/* ステップインジケーター */}
              {primaryUpload && !isAllDone && (
                <div className="px-3 sm:px-6 pt-4 sm:pt-5 pb-2">
                  <div className="flex items-center justify-between">
                    {UPLOAD_STEPS.filter(s => s.key !== 'done').map((step, i) => {
                      const stepIdx = UPLOAD_STEPS.findIndex(s => s.key === step.key)
                      const isDone = currentStepIndex > stepIdx
                      const isCurrent = currentStepIndex === stepIdx
                      return (
                        <div key={step.key} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <motion.div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                isDone
                                  ? 'bg-green-500 shadow-md shadow-green-500/30'
                                  : isCurrent
                                  ? 'bg-[#7f19e6] shadow-md shadow-[#7f19e6]/30'
                                  : 'bg-slate-100'
                              }`}
                              animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <span className={`material-symbols-outlined text-lg ${
                                isDone || isCurrent ? 'text-white' : 'text-slate-400'
                              }`}>
                                {isDone ? 'check' : isCurrent ? step.activeIcon : step.icon}
                              </span>
                            </motion.div>
                            <span className={`text-[9px] font-bold mt-1.5 text-center leading-tight ${
                              isDone ? 'text-green-600' : isCurrent ? 'text-[#7f19e6]' : 'text-slate-400'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                          {i < UPLOAD_STEPS.length - 2 && (
                            <div className={`h-0.5 w-full max-w-[30px] mx-0.5 rounded-full transition-all ${
                              isDone ? 'bg-green-400' : 'bg-slate-200'
                            }`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ファイル別進捗 */}
              <div className="px-4 sm:px-6 py-4 space-y-3 max-h-[200px] overflow-y-auto">
                {allUploads.map(([key, upload]) => {
                  const speedInfo = uploadSpeedRef.current.get(key)
                  const speed = speedInfo?.speed || 0
                  const remaining = speed > 0 && upload.status === 'uploading'
                    ? (upload.file.size * (1 - upload.progress / 100)) / speed
                    : 0
                  const isDone = upload.status === 'done'
                  const isError = upload.status === 'error'
                  const isUploading = upload.status === 'uploading'
                  const effectiveProgress = isDone || upload.status === 'transcribing' || upload.status === 'confirming' ? 100 : upload.progress

                  return (
                    <motion.div
                      key={key}
                      layout
                      className={`rounded-xl p-4 border transition-all ${
                        isDone ? 'bg-green-50 border-green-200' :
                        isError ? 'bg-red-50 border-red-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2.5">
                        <motion.div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isDone ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-[#7f19e6]'
                          }`}
                          animate={!isDone && !isError ? { rotate: [0, 5, -5, 0] } : {}}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <span className="material-symbols-outlined text-white text-xl">
                            {isDone ? 'check_circle' : isError ? 'error' : upload.status === 'transcribing' ? 'graphic_eq' : 'cloud_upload'}
                          </span>
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{upload.file.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono">{formatFileSize(upload.file.size)}</span>
                            {isUploading && speed > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-[#7f19e6] font-bold">{formatSpeed(speed)}</span>
                                {remaining > 0 && remaining < 3600 && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span>残り{remaining < 60 ? `${Math.ceil(remaining)}秒` : `${Math.ceil(remaining / 60)}分`}</span>
                                  </>
                                )}
                              </>
                            )}
                            {upload.status === 'creating' && <span className="text-amber-500 font-bold">プロジェクト作成中...</span>}
                            {upload.status === 'confirming' && <span className="text-[#7f19e6] font-bold">確認処理中...</span>}
                            {upload.status === 'transcribing' && <span className="text-[#7f19e6] font-bold">文字起こし開始...</span>}
                            {isDone && <span className="text-green-600 font-bold">完了</span>}
                            {isError && <span className="text-red-500 font-bold">{upload.error}</span>}
                          </div>
                        </div>
                        {isUploading && (
                          <span className="text-lg font-black text-[#7f19e6] tabular-nums">{upload.progress}%</span>
                        )}
                      </div>
                      {/* プログレスバー */}
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            isDone ? 'bg-green-500' :
                            isError ? 'bg-red-400' :
                            'bg-gradient-to-r from-[#7f19e6] to-[#b366f0]'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${effectiveProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      {isError && (
                        <div className="mt-2 flex items-center gap-2">
                          <motion.button
                            onClick={() => {
                              const file = upload.file
                              setUploads((prev) => { const next = new Map(prev); next.delete(key); return next })
                              uploadFromDashboard(file)
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors shadow-sm min-h-[44px]"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            再試行
                          </motion.button>
                          {upload.errorActionUrl && (
                            <motion.a
                              href={upload.errorActionUrl}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#7f19e6] text-white rounded-lg text-xs font-bold hover:bg-[#6b12c9] transition-colors shadow-sm min-h-[44px]"
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {upload.errorActionUrl.includes('signin') ? 'login' : 'upgrade'}
                              </span>
                              {upload.errorActionLabel || '詳細'}
                            </motion.a>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {/* 豆知識セクション */}
              {!isAllDone && (
                <div className="mx-4 sm:mx-6 mb-5 p-3 sm:p-4 bg-gradient-to-r from-[#7f19e6]/5 via-[#9b3ae6]/5 to-[#b366f0]/5 rounded-xl border border-[#7f19e6]/10">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tipIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm text-lg">
                        {UPLOAD_TIPS[tipIndex].emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-[#7f19e6]/50 uppercase tracking-wider mb-0.5">豆知識</p>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{UPLOAD_TIPS[tipIndex].text}</p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  {/* ドットインジケーター */}
                  <div className="flex justify-center gap-1.5 mt-3">
                    {UPLOAD_TIPS.map((_, i) => (
                      <motion.div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === tipIndex ? 'bg-[#7f19e6] w-5' : 'bg-slate-300 w-1.5'}`}
                        layout
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 完了時のアクション */}
              {isAllDone && doneUploads.length > 0 && (
                <div className="px-4 sm:px-6 pb-6 space-y-3">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 bg-green-50 rounded-xl border border-green-200 text-center"
                  >
                    <p className="text-sm font-bold text-green-700 mb-1">
                      {doneUploads.length}件のファイルをアップロードしました
                    </p>
                    <p className="text-xs text-green-600/70">
                      文字起こしはバックグラウンドで進行中です
                    </p>
                  </motion.div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      onClick={() => {
                        setUploads(new Map())
                        uploadSpeedRef.current.clear()
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-sm min-h-[44px]"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      閉じる
                    </motion.button>
                    {doneUploads[0]?.[1]?.projectId && (
                      <motion.button
                        onClick={() => router.push(`/interview/projects/${doneUploads[0][1].projectId}/materials`)}
                        className="flex-1 px-4 py-3 rounded-xl bg-[#7f19e6] text-white font-bold hover:bg-[#6b12c9] transition-colors text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-[#7f19e6]/25 min-h-[44px]"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        プロジェクトを開く
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
          )
        })()}
      </AnimatePresence>,
      document.body)}

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-700">schedule</span>
            <h2 className="text-lg font-black text-slate-900">最近のプロジェクト</h2>
          </div>
          {session?.user && (
            <Link
              href="/interview/projects"
              className="text-sm font-bold text-[#7f19e6] hover:underline py-2 min-h-[44px] inline-flex items-center"
            >
              すべて表示
            </Link>
          )}
        </div>

        {!session?.user ? (
          <div className="bg-white rounded-xl p-6 sm:p-12 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-[#7f19e6]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#7f19e6] text-3xl">lock</span>
            </div>
            <p className="text-slate-900 font-bold mb-1">ログインしてプロジェクトを管理</p>
            <p className="text-slate-500 text-sm mb-4">ログインすると、過去のプロジェクト一覧の閲覧や管理ができます</p>
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center gap-2 bg-[#7f19e6] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#6b12c9] transition-all shadow-lg shadow-[#7f19e6]/25 min-h-[44px]"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              ログインする
            </Link>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="bg-white rounded-xl p-6 sm:p-12 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-[#7f19e6]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#7f19e6] text-3xl">mic</span>
            </div>
            <p className="text-slate-900 font-bold mb-1">まだプロジェクトがありません</p>
            <p className="text-slate-500 text-sm">上のエリアからファイルをアップロードして始めましょう</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {recentProjects.map((project) => {
              const status = getStatusLabel(project.status)
              const gradient = GENRE_COLORS[project.genre || ''] || GENRE_COLORS.OTHER

              return (
                <motion.div key={project.id} variants={cardVariants}>
                  <Link
                    href={getProjectLink(project)}
                    className="group bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 sm:gap-3.5 hover:border-[#7f19e6]/30 hover:shadow-md transition-all min-h-[44px]"
                  >
                    {/* Thumbnail */}
                    {project.thumbnailUrl ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                        <span className="material-symbols-outlined text-white/80 text-xl">mic</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-[#7f19e6] transition-colors flex-1">
                          {project.articleTitle || project.title}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      {/* 文字起こし要約 */}
                      {(project.transcriptionSummary || project.transcriptionExcerpt) && (
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-1">
                          <span className="material-symbols-outlined text-[10px] text-[#7f19e6] mr-0.5 align-middle">mic</span>
                          {project.transcriptionSummary || project.transcriptionExcerpt}
                        </p>
                      )}
                      {/* 記事サマリー */}
                      {project.articleSummary && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-1">
                          {project.articleSummary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold">
                        <span>{getTimeSince(project.updatedAt)}</span>
                        {project.materialCount > 0 && (
                          <>
                            <span>·</span>
                            <span>素材 {project.materialCount}件</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
      {/* アップセルモーダル */}
      <InterviewUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        limitType={upsellLimitType}
        isGuest={upsellIsGuest}
      />
    </motion.div>
  )
}
