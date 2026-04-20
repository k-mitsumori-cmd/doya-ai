'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'

interface Project {
  id: string
  title: string
  status: string
  intervieweeName: string | null
  genre: string | null
  thumbnailUrl?: string | null
  materialCount: number
  draftCount: number
  createdAt: string
  updatedAt: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'creating' | 'uploading' | 'confirming' | 'transcribing' | 'done' | 'error'
  error?: string
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

export default function InterviewDashboard() {
  const { data: session } = useSession()
  const userName = (session?.user?.name || '').split(' ')[0] || 'ゲスト'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map())

  // プロジェクト一覧取得
  useEffect(() => {
    fetch('/api/interview/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProjects(data.projects || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
      if (!projectData.success) throw new Error(projectData.error || 'プロジェクト作成失敗')

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
      if (!urlData.success) throw new Error(urlData.error || 'アップロードURL取得失敗')

      const { signedUrl, materialId } = urlData

      // Step 3: Supabase Storage へ直接PUT
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
            setUploads((prev) => {
              const next = new Map(prev)
              const item = next.get(uploadKey)
              if (item) next.set(uploadKey, { ...item, progress, materialId })
              return next
            })
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: ${xhr.status}`))
        })
        xhr.addEventListener('error', () => reject(new Error('ネットワークエラー')))

        const formData = new FormData()
        formData.append('cacheControl', '3600')
        formData.append('', file, file.name)
        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(formData)
      })

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

      // Step 5: 音声/動画なら自動文字起こし
      const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/')
      if (isAudioVideo && materialId) {
        setUploads((prev) => {
          const next = new Map(prev)
          const item = next.get(uploadKey)
          if (item) next.set(uploadKey, { ...item, status: 'transcribing' })
          return next
        })

        fetch(`/api/interview/materials/${materialId}/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(console.error)
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
        if (item) next.set(uploadKey, { ...item, status: 'error', error: e.message })
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
          className="text-3xl font-black tracking-tight text-slate-900 mb-2"
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
        <div className="p-8 md:p-12">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-14 px-6 transition-all cursor-pointer group ${
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
            <h3 className="text-xl font-black text-slate-900 mb-1.5">インタビュー記事を作成する</h3>
            <p className="text-slate-500 text-sm mb-6">
              動画・音声ファイルをドラッグ&ドロップ。MP4, MOV, MP3 最大10GBまで
            </p>
            <span className="bg-[#7f19e6] text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-[#6b12c9] transition-all shadow-lg shadow-[#7f19e6]/25 inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">add_circle</span>
              ファイルを選択
            </span>
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="material-symbols-outlined text-[#7f19e6] text-xl">record_voice_over</span>
              <div>
                <p className="text-xs font-black text-slate-900">話者分離</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自動対応</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="material-symbols-outlined text-[#7f19e6] text-xl">auto_awesome</span>
              <div>
                <p className="text-xs font-black text-slate-900">AI記事下書き</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自動生成</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence>
        {uploads.size > 0 && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {Array.from(uploads.entries()).map(([key, upload]) => (
              <div key={key} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`material-symbols-outlined text-2xl ${
                      upload.status === 'done' ? 'text-emerald-500' :
                      upload.status === 'error' ? 'text-red-500' :
                      'text-[#7f19e6]'
                    }`}>
                      {upload.status === 'done' ? 'check_circle' :
                       upload.status === 'error' ? 'error' :
                       upload.status === 'creating' ? 'folder' :
                       upload.status === 'transcribing' ? 'mic' :
                       'upload_file'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{upload.file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(upload.file.size)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {upload.status === 'creating' && 'プロジェクト作成中...'}
                    {upload.status === 'uploading' && `${upload.progress}%`}
                    {upload.status === 'confirming' && '確認中...'}
                    {upload.status === 'transcribing' && '文字起こし開始...'}
                    {upload.status === 'done' && '完了'}
                    {upload.status === 'error' && upload.error}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      upload.status === 'error' ? 'bg-red-500' :
                      upload.status === 'done' ? 'bg-emerald-500' :
                      'bg-[#7f19e6]'
                    }`}
                    style={{ width: `${upload.status === 'done' || upload.status === 'transcribing' || upload.status === 'confirming' ? 100 : upload.progress}%` }}
                  />
                </div>
                {upload.status === 'error' && (
                  <button
                    onClick={() => {
                      const file = upload.file
                      setUploads((prev) => { const next = new Map(prev); next.delete(key); return next })
                      uploadFromDashboard(file)
                    }}
                    className="mt-2 text-xs font-bold text-red-600 hover:underline"
                  >
                    再試行
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-700">schedule</span>
            <h2 className="text-lg font-black text-slate-900">最近のプロジェクト</h2>
          </div>
          <Link
            href="/interview/projects"
            className="text-sm font-bold text-[#7f19e6] hover:underline"
          >
            すべて表示
          </Link>
        </div>

        {loading ? (
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
          <div className="bg-white rounded-xl p-12 border border-slate-200 text-center">
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
                    className="group bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3.5 hover:border-[#7f19e6]/30 hover:shadow-md transition-all"
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
                          {project.title}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
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
    </motion.div>
  )
}
