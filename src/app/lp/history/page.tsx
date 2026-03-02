'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, Loader2, Trash2, ExternalLink, Plus, Search } from 'lucide-react'

interface Project {
  id: string
  name: string
  status: string
  themeId: string
  purpose: string[]
  createdAt: string
  updatedAt: string
  _count?: { sections: number }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'text-slate-400 bg-slate-800' },
  generating: { label: '生成中', color: 'text-amber-400 bg-amber-500/10' },
  editing: { label: '編集中', color: 'text-blue-400 bg-blue-500/10' },
  completed: { label: '完成', color: 'text-cyan-400 bg-cyan-500/10' },
  published: { label: '公開中', color: 'text-green-400 bg-green-500/10' },
}

export default function LpHistoryPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/lp/projects?limit=50')
      .then(r => r.json())
      .then(data => {
        if (data.projects) setProjects(data.projects)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    setDeletingId(id)
    try {
      await fetch(`/api/lp/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (e: any) {
      alert(e.message || '削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">制作履歴</h1>
            <p className="text-slate-400 text-sm mt-1">過去に作成したLPの一覧</p>
          </div>
          <button
            onClick={() => router.push('/lp/new/input')}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規作成
          </button>
        </div>

        {/* 検索 */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="プロジェクト名で検索..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">
              {search ? '検索結果が見つかりません' : 'まだLPが作成されていません'}
            </p>
            {!search && (
              <button
                onClick={() => router.push('/lp/new/input')}
                className="text-cyan-400 hover:text-cyan-300 text-sm mt-2"
              >
                最初のLPを作成する →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((project, i) => {
              const status = STATUS_LABELS[project.status] ?? STATUS_LABELS.draft
              const sectionCount = project._count?.sections ?? 0
              const date = new Date(project.updatedAt).toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'short', day: 'numeric',
              })

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex items-center gap-4 group transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-cyan-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white truncate">{project.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>テーマ: {project.themeId}</span>
                      {sectionCount > 0 && <span>{sectionCount}セクション</span>}
                      <span>{date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/lp/${project.id}`)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">開く</span>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      disabled={deletingId === project.id}
                      className="p-2 text-slate-700 hover:text-red-400 transition-colors"
                    >
                      {deletingId === project.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-slate-600 text-center mt-6">
            {filtered.length}件のプロジェクト
          </p>
        )}
      </div>
    </div>
  )
}
