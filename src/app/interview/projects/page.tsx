'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface Project {
  id: string
  title: string
  status: string
  intervieweeName: string | null
  intervieweeCompany: string | null
  genre: string | null
  thumbnailUrl?: string | null
  materialCount: number
  draftCount: number
  articleTitle: string | null
  articleSummary: string | null
  transcriptionSummary: string | null
  transcriptionExcerpt: string | null
  createdAt: string
  updatedAt: string
}

const GENRE_GRADIENTS: Record<string, string> = {
  CASE_STUDY: 'from-blue-400 to-indigo-500',
  PRODUCT_INTERVIEW: 'from-emerald-400 to-teal-500',
  PERSONA_INTERVIEW: 'from-violet-400 to-blue-500',
  PANEL_DISCUSSION: 'from-amber-400 to-orange-500',
  EVENT_REPORT: 'from-rose-400 to-pink-500',
  OTHER: 'from-slate-400 to-slate-500',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600 border border-slate-200', icon: 'draft' },
  PLANNING: { label: '企画中', color: 'bg-blue-50 text-blue-600 border border-blue-200', icon: 'lightbulb' },
  TRANSCRIBING: { label: '文字起こし中', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: 'sync' },
  EDITING: { label: '編集中', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'edit_note' },
  REVIEWING: { label: 'レビュー中', color: 'bg-indigo-50 text-indigo-600 border border-indigo-200', icon: 'rate_review' },
  COMPLETED: { label: '完了', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200', icon: 'check_circle' },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [query, setQuery] = useState('')
  const [generatingThumbnail, setGeneratingThumbnail] = useState<string | null>(null)
  const autoGenRef = useRef<Set<string>>(new Set())

  const generateThumbnailForProject = useCallback(async (projectId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/interview/projects/${projectId}/thumbnail`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.thumbnailUrl) {
        return data.thumbnailUrl
      }
    } catch (err) {
      console.error(`[auto-thumbnail] Failed for ${projectId}:`, err)
    }
    return null
  }, [])

  useEffect(() => {
    fetch('/api/interview/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProjects(data.projects || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // サムネイル未生成プロジェクトの自動生成
  useEffect(() => {
    if (loading || projects.length === 0) return

    const pending = projects.filter(
      (p) => !p.thumbnailUrl && !autoGenRef.current.has(p.id)
    )
    if (pending.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const p of pending) {
        if (cancelled) break
        autoGenRef.current.add(p.id)
        setGeneratingThumbnail(p.id)

        const url = await generateThumbnailForProject(p.id)
        if (url && !cancelled) {
          setProjects((prev) =>
            prev.map((proj) => (proj.id === p.id ? { ...proj, thumbnailUrl: url } : proj))
          )
        }

        setGeneratingThumbnail(null)
        if (!cancelled) await new Promise((r) => setTimeout(r, 1000))
      }
    })()

    return () => { cancelled = true }
  }, [loading, projects.length, generateThumbnailForProject])

  const filtered = projects.filter((p) => {
    if (filter !== 'ALL' && p.status !== filter) return false
    if (query) {
      const q = query.toLowerCase()
      return (
        p.title.toLowerCase().includes(q) ||
        p.intervieweeName?.toLowerCase().includes(q) ||
        p.intervieweeCompany?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const getProjectLink = (p: Project) => {
    if (p.draftCount > 0) return `/interview/projects/${p.id}/edit`
    if (p.materialCount > 0) return `/interview/projects/${p.id}/skill`
    return `/interview/projects/${p.id}/materials`
  }

  const handleGenerateThumbnail = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setGeneratingThumbnail(projectId)
    try {
      const res = await fetch(`/api/interview/projects/${projectId}/thumbnail`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.thumbnailUrl) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, thumbnailUrl: data.thumbnailUrl } : p))
        )
        toast.success('サムネイルを生成しました')
      } else {
        toast.error(data.error || 'サムネイル生成に失敗しました')
      }
    } catch (err) {
      console.error('Thumbnail generation failed:', err)
      toast.error('サムネイル生成中にエラーが発生しました')
    } finally {
      setGeneratingThumbnail(null)
    }
  }

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}日前`
    return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  const filterCounts = {
    ALL: projects.length,
    DRAFT: projects.filter((p) => p.status === 'DRAFT').length,
    EDITING: projects.filter((p) => p.status === 'EDITING').length,
    COMPLETED: projects.filter((p) => p.status === 'COMPLETED').length,
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">記事一覧</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {projects.length > 0
              ? `${projects.length}件の記事`
              : 'インタビュー記事を管理'}
          </p>
        </div>
        <Link
          href="/interview"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#7f19e6] text-white rounded-xl text-sm font-bold hover:bg-[#6b12c9] transition-colors shadow-lg shadow-[#7f19e6]/20"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          新規作成
        </Link>
      </div>

      {/* フィルター & 検索 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'DRAFT', 'EDITING', 'COMPLETED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === s
                  ? 'bg-[#7f19e6] text-white shadow-sm'
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {s === 'ALL' ? 'すべて' : STATUS_CONFIG[s]?.label || s}
              <span className={`ml-1 tabular-nums ${filter === s ? 'text-white/70' : 'text-slate-400'}`}>
                {filterCounts[s]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto w-full sm:w-auto">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索..."
            className="w-full sm:w-56 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] bg-white transition-all"
          />
        </div>
      </div>

      {/* 記事グリッド */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse overflow-hidden">
                <div className="aspect-video bg-slate-100" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 bg-[#7f19e6]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#7f19e6] text-3xl">
                {query ? 'search_off' : 'mic'}
              </span>
            </div>
            <p className="text-slate-900 font-bold mb-1">
              {query ? '検索結果がありません' : 'まだ記事がありません'}
            </p>
            <p className="text-slate-500 text-sm mb-4">
              {query ? '別のキーワードで試してみてください' : 'インタビュー素材をアップロードして記事を作成しましょう'}
            </p>
            {!query && (
              <Link
                href="/interview"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7f19e6] text-white rounded-xl text-sm font-bold hover:bg-[#6b12c9] transition-colors shadow-lg shadow-[#7f19e6]/20"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                記事を作成する
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {filtered.map((p) => {
              const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT
              const gradient = GENRE_GRADIENTS[p.genre || 'OTHER'] || GENRE_GRADIENTS.OTHER
              const isGenerating = generatingThumbnail === p.id
              return (
                <motion.div key={p.id} variants={cardVariants}>
                  <Link
                    href={getProjectLink(p)}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-[#7f19e6]/30"
                  >
                    {/* サムネイル */}
                    <div className="aspect-video relative overflow-hidden bg-slate-50">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={p.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform duration-500 group-hover:scale-105`}>
                          <span className="material-symbols-outlined text-white/50 text-5xl">mic</span>
                        </div>
                      )}
                      {/* ステータスバッジ */}
                      <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 backdrop-blur-sm ${status.color}`}>
                        <span className="material-symbols-outlined text-[10px]">{status.icon}</span>
                        {status.label}
                      </div>
                      {/* サムネイル再生成ボタン */}
                      <button
                        onClick={(e) => handleGenerateThumbnail(e, p.id)}
                        disabled={isGenerating}
                        className={`absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm transition-all flex items-center gap-1 disabled:opacity-70 ${
                          p.thumbnailUrl
                            ? 'bg-black/40 text-white hover:bg-black/60 opacity-0 group-hover:opacity-100'
                            : 'bg-white/90 text-slate-700 hover:bg-white'
                        }`}
                      >
                        {isGenerating ? (
                          <>
                            <span className="material-symbols-outlined text-[10px] animate-spin">progress_activity</span>
                            生成中
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                            {p.thumbnailUrl ? '再生成' : 'AI生成'}
                          </>
                        )}
                      </button>
                    </div>

                    {/* カード情報 */}
                    <div className="p-4">
                      {/* 記事タイトル（優先表示） */}
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-2 group-hover:text-[#7f19e6] transition-colors mb-1">
                        {p.articleTitle || p.title}
                      </h4>

                      {/* プロジェクト名（記事タイトルと異なる場合のみ表示） */}
                      {p.articleTitle && p.articleTitle !== p.title && (
                        <p className="text-[11px] text-slate-400 truncate mb-1">
                          <span className="material-symbols-outlined text-[11px] text-slate-400 mr-0.5 align-middle">folder</span>
                          {p.title}
                        </p>
                      )}

                      {(p.intervieweeName || p.intervieweeCompany) && (
                        <p className="text-[11px] text-slate-500 truncate mb-2">
                          {[p.intervieweeName, p.intervieweeCompany].filter(Boolean).join(' / ')}
                        </p>
                      )}

                      {/* 文字起こし要約 or 抜粋 */}
                      {(p.transcriptionSummary || p.transcriptionExcerpt) && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="material-symbols-outlined text-[11px] text-[#7f19e6]">mic</span>
                            <span className="text-[10px] font-bold text-[#7f19e6]">文字起こし</span>
                          </div>
                          <p className={`text-[11px] leading-relaxed line-clamp-2 ${p.transcriptionSummary ? 'text-slate-600' : 'text-slate-500'}`}>
                            {p.transcriptionSummary || p.transcriptionExcerpt}
                          </p>
                        </div>
                      )}

                      {/* 記事サマリー */}
                      {p.articleSummary && (
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2">
                          {p.articleSummary}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">attach_file</span>
                            {p.materialCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">description</span>
                            {p.draftCount}
                          </span>
                        </div>
                        <span>{getTimeSince(p.updatedAt)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
