'use client'
// ============================================
// ドヤムービーAI - 生成履歴
// ============================================
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import type { MovieProjectData } from '@/lib/movie/types'

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
  rendering: 'text-purple-300 bg-purple-900/40',
  completed: 'text-emerald-300 bg-emerald-900/40',
  failed: 'text-red-300 bg-red-900/40',
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<MovieProjectData[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt'>('updatedAt')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const fetchProjects = () => {
    setLoading(true)
    fetch('/api/movie/projects?limit=50')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (d.projects) setProjects(d.projects) })
      .catch(() => toast.error('読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProjects() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('このプロジェクトを削除しますか？')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/movie/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setProjects(prev => prev.filter(p => p.id !== id))
      toast.success('削除しました')
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = projects
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .sort((a, b) => new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime())

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">生成履歴</h1>
          <p className="text-rose-200/60 text-sm">{projects.length}件のプロジェクト</p>
        </div>
        <Link
          href="/movie/new/concept"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-white text-sm transition-all"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          <span className="material-symbols-outlined text-base">add</span>
          新規作成
        </Link>
      </div>

      {/* フィルタ・ソート */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all', label: 'すべて' },
          { id: 'completed', label: '完成' },
          { id: 'editing', label: '編集中' },
          { id: 'draft', label: '下書き' },
          { id: 'failed', label: 'エラー' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              filterStatus === f.id
                ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                : 'border-rose-900/30 text-slate-400 hover:border-rose-700/50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="ml-auto bg-slate-800/60 border border-rose-900/40 rounded-lg px-3 py-1 text-white text-xs focus:outline-none"
        >
          <option value="updatedAt">更新日順</option>
          <option value="createdAt">作成日順</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-rose-900/30 bg-slate-900/60 animate-pulse h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-rose-200/50 mb-4">
            {filterStatus === 'all' ? 'まだプロジェクトがありません' : 'このステータスのプロジェクトはありません'}
          </p>
          {filterStatus === 'all' && (
            <Link
              href="/movie/new/concept"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
            >
              最初の動画を作る
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(project => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex gap-4 rounded-xl border border-rose-900/30 bg-slate-900/60 hover:bg-rose-950/30 transition-all p-3"
              >
                {/* サムネイル */}
                <Link href={`/movie/${project.id}`} className="flex-shrink-0">
                  <div className="w-28 aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-rose-950/60 to-slate-900 flex items-center justify-center">
                    {project.thumbnailUrl ? (
                      <img src={project.thumbnailUrl} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl opacity-30">🎬</span>
                    )}
                  </div>
                </Link>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Link href={`/movie/${project.id}`} className="hover:text-rose-200 transition-colors">
                      <h3 className="text-white font-bold text-sm truncate">{project.name}</h3>
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[project.status] || 'text-slate-400 bg-slate-800'}`}>
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-rose-300/50 text-xs mb-2">
                    <span>{project.aspectRatio}</span>
                    <span>{project.duration}秒</span>
                    <span>{new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div className="flex gap-2">
                    {project.status !== 'completed' && (
                      <Link
                        href={`/movie/${project.id}/edit`}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-rose-300 border border-rose-900/40 hover:bg-rose-900/20 transition-all"
                      >
                        編集
                      </Link>
                    )}
                    {project.status === 'completed' && (
                      <Link
                        href={`/movie/${project.id}`}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-all"
                        style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
                      >
                        ダウンロード
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(project.id)}
                      disabled={deleting === project.id}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-red-400/70 border border-red-900/30 hover:bg-red-900/20 transition-all disabled:opacity-50"
                    >
                      {deleting === project.id ? '削除中...' : '削除'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
