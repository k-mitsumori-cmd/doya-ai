'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Head from 'next/head'

interface ProjectDetail {
  id: string
  title: string
  status: string
  intervieweeName: string | null
  intervieweeRole: string | null
  intervieweeCompany: string | null
  intervieweeBio: string | null
  genre: string | null
  theme: string | null
  purpose: string | null
  targetAudience: string | null
  tone: string | null
  mediaType: string | null
  recipe: { id: string; name: string; category: string } | null
  materials: {
    id: string
    type: string
    fileName: string
    fileSize: number | null
    status: string
    createdAt: string
  }[]
  transcriptions: {
    id: string
    materialId: string
    status: string
    summary: string | null
    provider: string | null
    confidence: number | null
    createdAt: string
  }[]
  drafts: {
    id: string
    version: number
    title: string | null
    displayFormat: string | null
    wordCount: number | null
    status: string
    createdAt: string
  }[]
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600 border border-slate-600/20', icon: 'edit_note' },
  PLANNING: { label: '企画中', color: 'bg-blue-100 text-blue-600 border border-blue-600/20', icon: 'assignment' },
  RECORDING: { label: '収録中', color: 'bg-yellow-100 text-yellow-700 border border-yellow-700/20', icon: 'mic' },
  TRANSCRIBING: { label: '文字起こし中', color: 'bg-blue-100 text-blue-700 border border-blue-700/20', icon: 'sync' },
  EDITING: { label: '編集中', color: 'bg-[#7f19e6]/10 text-[#7f19e6] border border-[#7f19e6]/20', icon: 'edit' },
  REVIEWING: { label: 'レビュー中', color: 'bg-cyan-100 text-cyan-600 border border-cyan-600/20', icon: 'visibility' },
  COMPLETED: { label: '完了', color: 'bg-green-100 text-green-600 border border-green-600/20', icon: 'check_circle' },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

const STEPS = [
  { key: 'materials', label: '素材アップ', route: 'materials', icon: 'upload_file' },
  { key: 'transcription', label: '文字起こし', route: 'materials', icon: 'transcribe' },
  { key: 'recipe', label: 'スキル選択', route: 'skill', icon: 'menu_book' },
  { key: 'generate', label: 'AI生成', route: 'generate', icon: 'auto_awesome' },
  { key: 'edit', label: '編集・校正', route: 'edit', icon: 'edit_note' },
]

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  return `${days}日前`
}

export default function ProjectOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetch(`/api/interview/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProject(data.project)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/interview/projects/${projectId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/interview/projects')
      } else {
        alert(data.error || '削除に失敗しました')
      }
    } catch {
      alert('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  // 進捗ステップ判定
  const getStepStatus = (stepKey: string): 'done' | 'active' | 'pending' => {
    if (!project) return 'pending'
    const hasMaterials = project.materials.length > 0
    const hasTranscriptions = project.transcriptions.some((t) => t.status === 'COMPLETED')
    const hasRecipe = !!project.recipe
    const hasDrafts = project.drafts.length > 0
    const hasPublished = project.drafts.some((d) => d.status === 'PUBLISHED')

    switch (stepKey) {
      case 'materials':
        return hasMaterials ? 'done' : 'active'
      case 'transcription':
        if (!hasMaterials) return 'pending'
        return hasTranscriptions ? 'done' : 'active'
      case 'recipe':
        if (!hasTranscriptions) return 'pending'
        return hasRecipe || hasDrafts ? 'done' : 'active'
      case 'generate':
        if (!hasTranscriptions) return 'pending'
        return hasDrafts ? 'done' : 'active'
      case 'edit':
        if (!hasDrafts) return 'pending'
        return hasPublished ? 'done' : 'active'
      default:
        return 'pending'
    }
  }

  if (loading) {
    return (
      <>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <motion.div className="space-y-6 sm:space-y-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="h-7 sm:h-8 bg-slate-200 rounded w-2/3 sm:w-1/3 animate-pulse" />
          <div className="h-32 sm:h-40 bg-slate-100 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        </motion.div>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">sentiment_dissatisfied</span>
          <p className="text-slate-900 font-medium">プロジェクトが見つかりません</p>
          <Link href="/interview/projects" className="text-sm text-[#7f19e6] hover:underline mt-2 inline-block">
            プロジェクト一覧に戻る
          </Link>
        </div>
      </>
    )
  }

  const st = STATUS_CONFIG[project.status] || STATUS_CONFIG.DRAFT
  const latestDraft = project.drafts[0]

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />
      <div className="space-y-8">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 break-words">{project.title}</h1>
              <span className={`px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 shrink-0 ${st.color}`}>
                <span className="material-symbols-outlined text-sm">{st.icon}</span>
                {st.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">calendar_today</span>
                {new Date(project.createdAt).toLocaleDateString('ja-JP')}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">update</span>
                {timeAgo(project.updatedAt)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-2 text-sm text-red-500 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              削除
            </button>
          </div>
        </div>

      {/* 進捗ステッパー */}
      <motion.div
        className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <p className="text-sm font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#7f19e6]">trending_up</span>
          プロジェクトの進捗
        </p>
        <div className="overflow-x-auto pb-2 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-max md:min-w-0">
            {STEPS.map((step, i) => {
              const status = getStepStatus(step.key)
              const currentStep = status === 'active'
              const completedStep = status === 'done'

              return (
                <div key={step.key} className="flex items-center gap-2 sm:gap-3 flex-1">
                  <Link
                    href={`/interview/projects/${projectId}/${step.route}`}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all flex-1 whitespace-nowrap ${
                      completedStep
                        ? 'bg-[#7f19e6] text-white hover:bg-[#6b12c9]'
                        : currentStep
                          ? 'bg-[#7f19e6]/10 text-[#7f19e6] border-2 border-[#7f19e6] hover:bg-[#7f19e6]/20'
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg sm:text-xl ${
                      completedStep ? 'filled' : ''
                    }`}>
                      {completedStep ? 'check_circle' : step.icon}
                    </span>
                    <span className="text-xs sm:text-sm font-medium tracking-tight">{step.label}</span>
                  </Link>
                  {i < STEPS.length - 1 && (
                    <span className={`material-symbols-outlined text-xl sm:text-2xl shrink-0 ${
                      completedStep ? 'text-[#7f19e6]' : 'text-slate-300'
                    }`}>
                      arrow_forward
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">進捗状況</span>
            <span className="text-xs font-semibold text-[#7f19e6]">
              {Math.round((STEPS.filter(s => getStepStatus(s.key) === 'done').length / STEPS.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-[#7f19e6]/20 rounded-full h-2">
            <div
              className="bg-[#7f19e6] h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(STEPS.filter(s => getStepStatus(s.key) === 'done').length / STEPS.length) * 100}%`
              }}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* プロジェクト情報 */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <p className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">info</span>
            プロジェクト情報
          </p>
          <div className="space-y-3 text-sm">
            {project.intervieweeName && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">person</span>
                  取材対象
                </span>
                <span className="text-slate-900 font-medium">
                  {project.intervieweeName}
                  {project.intervieweeRole && ` / ${project.intervieweeRole}`}
                </span>
              </div>
            )}
            {project.intervieweeCompany && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">business</span>
                  所属
                </span>
                <span className="text-slate-900">{project.intervieweeCompany}</span>
              </div>
            )}
            {project.genre && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">category</span>
                  ジャンル
                </span>
                <span className="text-slate-900">{project.genre}</span>
              </div>
            )}
            {project.targetAudience && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">groups</span>
                  想定読者
                </span>
                <span className="text-slate-900">{project.targetAudience}</span>
              </div>
            )}
            {project.tone && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">sentiment_satisfied</span>
                  トーン
                </span>
                <span className="text-slate-900">{project.tone}</span>
              </div>
            )}
            {project.recipe && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">menu_book</span>
                  スキル
                </span>
                <span className="text-slate-900">{project.recipe.name}</span>
              </div>
            )}
            {project.theme && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
                <span className="text-slate-500 flex items-center gap-1 shrink-0">
                  <span className="material-symbols-outlined text-base">lightbulb</span>
                  テーマ
                </span>
                <span className="text-slate-900 sm:text-right sm:max-w-[200px] truncate pl-5 sm:pl-0">{project.theme}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* 統計サマリ */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
          <p className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">analytics</span>
            統計
          </p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-[#7f19e6]/5 to-blue-50 rounded-xl p-3 sm:p-4 text-center border border-[#7f19e6]/10">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#7f19e6] mb-1">folder_open</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900">{project.materials.length}</p>
              <p className="text-xs text-slate-500">素材</p>
            </div>
            <div className="bg-gradient-to-br from-[#7f19e6]/5 to-blue-50 rounded-xl p-3 sm:p-4 text-center border border-[#7f19e6]/10">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#7f19e6] mb-1">transcribe</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900">
                {project.transcriptions.filter((t) => t.status === 'COMPLETED').length}
              </p>
              <p className="text-xs text-slate-500">文字起こし済</p>
            </div>
            <div className="bg-gradient-to-br from-[#7f19e6]/5 to-blue-50 rounded-xl p-3 sm:p-4 text-center border border-[#7f19e6]/10">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#7f19e6] mb-1">draft</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900">{project.drafts.length}</p>
              <p className="text-xs text-slate-500">ドラフト</p>
            </div>
            <div className="bg-gradient-to-br from-[#7f19e6]/5 to-blue-50 rounded-xl p-3 sm:p-4 text-center border border-[#7f19e6]/10">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#7f19e6] mb-1">article</span>
              <p className="text-xl sm:text-2xl font-black text-[#7f19e6]">
                {latestDraft?.wordCount?.toLocaleString() || '-'}
              </p>
              <p className="text-xs text-slate-500">文字数</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* 素材一覧 */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">folder_open</span>
            素材 ({project.materials.length})
          </p>
          <Link
            href={`/interview/projects/${projectId}/materials`}
            className="text-sm text-[#7f19e6] hover:underline flex items-center gap-1"
          >
            管理
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
        {project.materials.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">cloud_upload</span>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">素材がまだアップロードされていません</p>
            <Link
              href={`/interview/projects/${projectId}/materials`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7f19e6] text-white rounded-xl text-sm hover:bg-[#6b12c9] transition-colors shadow-lg shadow-[#7f19e6]/20"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              素材をアップロード
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {project.materials.map((m) => {
              const trans = project.transcriptions.find((t) => t.materialId === m.id)
              return (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-3 px-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-[#7f19e6]/30 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-2xl text-[#7f19e6] shrink-0">
                      {m.type === 'AUDIO' ? 'audio_file' : m.type === 'VIDEO' ? 'videocam' : 'description'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 truncate font-bold leading-snug">{m.fileName}</p>
                      <p className="text-xs text-slate-400 font-mono">{formatFileSize(m.fileSize)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0 pl-9 sm:pl-0">
                    {trans ? (
                      <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
                        trans.status === 'COMPLETED' ? 'bg-green-100 text-green-600 border border-green-600/20' :
                        trans.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-600 border border-yellow-600/20' :
                        'bg-red-100 text-red-600 border border-red-600/20'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {trans.status === 'COMPLETED' ? 'check_circle' : trans.status === 'PROCESSING' ? 'sync' : 'error'}
                        </span>
                        {trans.status === 'COMPLETED' ? '文字起こし済' : trans.status === 'PROCESSING' ? '処理中' : 'エラー'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">未処理</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ドラフト一覧 */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">draft</span>
            記事ドラフト ({project.drafts.length})
          </p>
          {project.drafts.length > 0 && (
            <Link
              href={`/interview/projects/${projectId}/edit?draftId=${project.drafts[0]?.id}`}
              className="text-sm text-[#7f19e6] hover:underline flex items-center gap-1"
            >
              エディタで開く
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          )}
        </div>
        {project.drafts.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">edit_note</span>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">記事がまだ生成されていません</p>
            {project.transcriptions.some((t) => t.status === 'COMPLETED') && (
              <Link
                href={`/interview/projects/${projectId}/skill`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7f19e6] text-white rounded-xl text-sm hover:bg-[#6b12c9] transition-colors shadow-lg shadow-[#7f19e6]/20"
              >
                <span className="material-symbols-outlined text-base">menu_book</span>
                スキルを選んで生成
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {project.drafts.map((d) => (
              <Link
                key={d.id}
                href={`/interview/projects/${projectId}/edit?draftId=${d.id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-3 px-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-[#7f19e6]/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-2xl text-[#7f19e6] shrink-0">article</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono shrink-0">v{d.version}</span>
                      <span className="text-sm text-slate-900 truncate font-bold leading-snug">{d.title || '（タイトル未設定）'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">text_fields</span>
                        {d.wordCount?.toLocaleString() || '-'}文字
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        {timeAgo(d.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-9 sm:pl-0">
                  <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${
                    d.status === 'PUBLISHED' ? 'bg-green-100 text-green-600 border border-green-600/20' :
                    d.status === 'REVIEW' ? 'bg-cyan-100 text-cyan-600 border border-cyan-600/20' :
                    'bg-slate-100 text-slate-500 border border-slate-500/20'
                  }`}>
                    <span className="material-symbols-outlined text-sm">
                      {d.displayFormat === 'QA' ? 'question_answer' : 'description'}
                    </span>
                    {d.displayFormat === 'QA' ? 'Q&A' : 'ストーリー'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pro Tip */}
      <div className="bg-gradient-to-r from-[#7f19e6]/10 to-blue-50 rounded-xl p-5 border border-[#7f19e6]/20">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-3xl text-[#7f19e6]">lightbulb</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-2">Pro Tip</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              各ステップを順番に進めることで、高品質な記事を効率的に作成できます。素材のアップロード → 文字起こし → スキル選択 → AI生成 → 編集の流れを意識しましょう。
            </p>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Link
          href={`/interview/projects/${projectId}/materials`}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 text-center shadow-sm hover:border-[#7f19e6] hover:shadow-lg transition-all group"
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#7f19e6] mb-2 group-hover:scale-110 transition-transform inline-block">folder_open</span>
          <p className="text-xs sm:text-sm text-slate-700 font-medium">素材管理</p>
        </Link>
        <Link
          href={`/interview/projects/${projectId}/skill`}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 text-center shadow-sm hover:border-[#7f19e6] hover:shadow-lg transition-all group"
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#7f19e6] mb-2 group-hover:scale-110 transition-transform inline-block">menu_book</span>
          <p className="text-xs sm:text-sm text-slate-700 font-medium">スキル選択</p>
        </Link>
        {latestDraft ? (
          <Link
            href={`/interview/projects/${projectId}/edit?draftId=${latestDraft.id}`}
            className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 text-center shadow-sm hover:border-[#7f19e6] hover:shadow-lg transition-all group"
          >
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#7f19e6] mb-2 group-hover:scale-110 transition-transform inline-block">edit</span>
            <p className="text-xs sm:text-sm text-slate-700 font-medium">記事編集</p>
          </Link>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 text-center opacity-50">
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-slate-400 mb-2 inline-block">edit</span>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">記事編集</p>
          </div>
        )}
        <Link
          href={`/interview/projects/${projectId}/skill`}
          className="bg-gradient-to-br from-[#7f19e6] to-blue-700 border border-[#7f19e6] rounded-xl p-4 sm:p-5 text-center hover:shadow-xl transition-all group"
        >
          <span className="material-symbols-outlined text-3xl sm:text-4xl text-white mb-2 group-hover:scale-110 transition-transform inline-block">auto_awesome</span>
          <p className="text-xs sm:text-sm text-white font-medium">再生成</p>
        </Link>
      </div>

      {/* 削除確認モーダル */}
      <AnimatePresence>
      {showDeleteConfirm && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-4xl text-red-500">warning</span>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">プロジェクトを削除</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-2">「{project.title}」を削除します。</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="text-xs text-red-600 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5">error</span>
                <span>全ての素材・文字起こし・記事ドラフトも削除されます。この操作は取り消せません。</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 font-medium transition-colors flex items-center justify-center gap-1"
              >
                {deleting ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    削除中...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    削除する
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
    </>
  )
}
