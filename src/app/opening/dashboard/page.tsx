'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, FolderOpen, Trash2, ExternalLink, Clock } from 'lucide-react'
import UrlInputForm from '@/components/opening/UrlInputForm'

interface Project {
  id: string
  inputUrl: string
  status: string
  createdAt: string
  _count?: { animations: number }
}

export default function OpeningDashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    fetch('/api/opening/projects')
      .then(r => r.json())
      .then(data => { if (data.projects) setProjects(data.projects) })
      .catch(() => {})
  }, [])

  const handleNewProject = async (url: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/opening/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.success && data.projectId) {
        router.push(`/opening/projects/${data.projectId}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このプロジェクトを削除しますか？')) return
    await fetch(`/api/opening/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-white">プロジェクト</h1>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#EF4343] rounded-xl font-bold text-white shadow-lg shadow-[#EF4343]/20 hover:shadow-[#EF4343]/40 transition-shadow"
        >
          <Plus className="h-4 w-4" />
          新規作成
        </button>
      </div>

      {showNewForm && (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <UrlInputForm onSubmit={handleNewProject} isLoading={isLoading} />
        </motion.div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FolderOpen className="h-16 w-16 text-white/10 mb-4" />
          <p className="text-white/40 mb-6">まだプロジェクトがありません</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-6 py-3 bg-[#EF4343] rounded-xl font-bold text-white"
          >
            最初のアニメーションを作る
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <motion.div
              key={project.id}
              className="flex items-center justify-between p-5 rounded-xl border border-white/5 bg-white/5 hover:border-[#EF4343]/20 transition-all group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EF4343]/10 flex-shrink-0">
                  <ExternalLink className="h-4 w-4 text-[#EF4343]" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{project.inputUrl}</p>
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <Clock className="h-3 w-3" />
                    {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      project.status === 'READY' ? 'bg-green-500/20 text-green-400'
                        : project.status === 'ANALYZING' ? 'bg-yellow-500/20 text-yellow-400'
                        : project.status === 'ERROR' ? 'bg-red-500/20 text-red-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/opening/projects/${project.id}`)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                >
                  開く
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
