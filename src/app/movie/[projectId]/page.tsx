'use client'
// ============================================
// ドヤムービーAI - プロジェクト詳細
// ============================================
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import type { MovieProjectData, RenderJobData } from '@/lib/movie/types'

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  planning: '企画中',
  editing: '編集中',
  rendering: 'レンダリング中',
  completed: '完成',
  failed: 'エラー',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-slate-400 bg-slate-800',
  planning: 'text-blue-300 bg-blue-900/40',
  editing: 'text-amber-300 bg-amber-900/40',
  rendering: 'text-purple-300 bg-purple-900/40 animate-pulse',
  completed: 'text-emerald-300 bg-emerald-900/40',
  failed: 'text-red-300 bg-red-900/40',
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<MovieProjectData | null>(null)
  const [job, setJob] = useState<RenderJobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/movie/projects/${projectId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProject(data.project)
      const latestJob = (data.project as any)?.renderJobs?.[0]
      if (latestJob) setJob(latestJob)
    } catch {
      toast.error('プロジェクトの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [projectId])

  // レンダリング中はポーリング
  useEffect(() => {
    if (job?.status === 'rendering' || job?.status === 'queued') {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/movie/render/${job.id}`)
          if (!res.ok) return
          const data = await res.json()
          setJob(data)
          if (data.status === 'completed') {
            clearInterval(pollRef.current!)
            setProject(p => p ? { ...p, status: 'completed', outputUrl: data.outputUrl } : p)
            toast.success('レンダリングが完成しました！')
          }
          if (data.status === 'failed') {
            clearInterval(pollRef.current!)
            toast.error('レンダリングに失敗しました')
          }
        } catch {}
      }, 3000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [job?.status, job?.id])

  const startRender = async () => {
    setRendering(true)
    try {
      const res = await fetch('/api/movie/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format: 'mp4' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'レンダリングに失敗しました')
      }
      const data = await res.json()
      setJob({ id: data.jobId, projectId: projectId!, status: data.status, progress: 0, format: 'mp4', createdAt: new Date().toISOString() })
      setProject(p => p ? { ...p, status: 'rendering' } : p)
      toast.success('レンダリングを開始しました')
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setRendering(false)
    }
  }

  const getDownload = async () => {
    if (!job?.id) return
    try {
      const res = await fetch(`/api/movie/render/${job.id}/download`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDownloadUrl(data.downloadUrl)
      window.open(data.downloadUrl, '_blank')
    } catch {
      toast.error('ダウンロードURLの取得に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <span className="material-symbols-outlined text-rose-400 animate-spin text-3xl">progress_activity</span>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 gap-4">
        <div className="text-4xl">🎬</div>
        <p className="text-rose-200/60">プロジェクトが見つかりません</p>
        <Link href="/movie" className="text-rose-400 hover:text-rose-300">ダッシュボードに戻る</Link>
      </div>
    )
  }

  const isRendering = project.status === 'rendering'
  const isCompleted = project.status === 'completed'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/movie/history" className="text-rose-400/60 hover:text-rose-300 text-sm transition-colors">
              履歴
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-rose-200/70 text-sm truncate max-w-xs">{project.name}</span>
          </div>
          <h1 className="text-xl font-black text-white">{project.name}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${STATUS_COLORS[project.status] || 'text-slate-400 bg-slate-800'}`}>
          {STATUS_LABELS[project.status] || project.status}
        </span>
      </div>

      {/* 動画プレビュー */}
      <div className="rounded-2xl border border-rose-900/30 bg-slate-900/60 overflow-hidden mb-6">
        <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-rose-950/50 to-slate-900 relative">
          {isCompleted && project.outputUrl ? (
            <video
              src={project.outputUrl}
              controls
              className="w-full h-full object-contain"
              poster={project.thumbnailUrl}
            />
          ) : project.thumbnailUrl ? (
            <img src={project.thumbnailUrl} alt={project.name} className="w-full h-full object-contain" />
          ) : (
            <div className="text-center">
              <div className="text-5xl mb-3 opacity-30">🎬</div>
              {isRendering ? (
                <div className="text-rose-200/60 text-sm">
                  <span className="material-symbols-outlined animate-spin text-rose-400 text-xl block mb-2">progress_activity</span>
                  レンダリング中...
                </div>
              ) : (
                <p className="text-rose-200/40 text-sm">プレビューなし</p>
              )}
            </div>
          )}
        </div>

        {/* レンダリング進捗バー */}
        {isRendering && job && (
          <div className="px-4 py-3 border-t border-rose-900/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-rose-300/70 text-xs">レンダリング進捗</span>
              <span className="text-rose-300 text-xs font-bold">{job.progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-rose-900/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex flex-wrap gap-3 mb-8">
        {isCompleted ? (
          <button
            onClick={getDownload}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
          >
            <span className="material-symbols-outlined">download</span>
            MP4をダウンロード
          </button>
        ) : !isRendering ? (
          <>
            <Link
              href={`/movie/${projectId}/edit`}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white border border-rose-500/40 hover:bg-rose-500/10 transition-all"
            >
              <span className="material-symbols-outlined">edit</span>
              編集する
            </Link>
            <button
              onClick={startRender}
              disabled={rendering}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
            >
              {rendering ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  開始中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">movie_creation</span>
                  レンダリング開始
                </>
              )}
            </button>
          </>
        ) : null}

        {isCompleted && (
          <Link
            href={`/movie/${projectId}/edit`}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-rose-300 border border-rose-900/30 hover:bg-rose-900/20 transition-all"
          >
            <span className="material-symbols-outlined">edit</span>
            再編集
          </Link>
        )}
      </div>

      {/* プロジェクト情報 */}
      <div className="rounded-xl border border-rose-900/30 bg-slate-900/40 p-5">
        <h2 className="text-white font-bold mb-4">プロジェクト情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-rose-300/60 text-xs mb-1">アスペクト比</div>
            <div className="text-white">{project.aspectRatio}</div>
          </div>
          <div>
            <div className="text-rose-300/60 text-xs mb-1">尺</div>
            <div className="text-white">{project.duration}秒</div>
          </div>
          <div>
            <div className="text-rose-300/60 text-xs mb-1">解像度</div>
            <div className="text-white">{project.resolution}</div>
          </div>
          <div>
            <div className="text-rose-300/60 text-xs mb-1">作成日</div>
            <div className="text-white">{new Date(project.createdAt).toLocaleDateString('ja-JP')}</div>
          </div>
          <div>
            <div className="text-rose-300/60 text-xs mb-1">更新日</div>
            <div className="text-white">{new Date(project.updatedAt).toLocaleDateString('ja-JP')}</div>
          </div>
          {project.platform && (
            <div>
              <div className="text-rose-300/60 text-xs mb-1">配信先</div>
              <div className="text-white">{project.platform}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
