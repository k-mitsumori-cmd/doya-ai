'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Clock, Plus, Search, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function InterviewProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/interview/projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">プロジェクト一覧</h1>
          <p className="text-slate-600">作成したインタビュープロジェクトを管理</p>
        </div>
        <Link
          href="/interview"
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          新規プロジェクト
        </Link>
      </div>

      {/* 検索バー */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="プロジェクト名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* プロジェクト一覧 */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">まだプロジェクトがありません</p>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            新規プロジェクトを作成
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects
            .filter((project) => project.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((project) => (
              <Link key={project.id} href={`/interview/projects/${project.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="p-6 bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-black text-slate-900 group-hover:text-orange-600 transition-colors flex-1">
                      {project.title}
                    </h3>
                    <span className="px-3 py-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 rounded-lg font-black text-xs border border-orange-200">
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 flex items-center gap-2">
                    {project.intervieweeName ? (
                      <>
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                        {project.intervieweeName}
                      </>
                    ) : (
                      <span className="text-slate-400">対象者未設定</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">{new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                    {project.drafts && project.drafts.length > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 font-black">
                        <FileText className="w-4 h-4" />
                        {project.drafts.length}件の記事
                      </div>
                    )}
                  </div>
                </motion.div>
              </Link>
            ))}
        </div>
      )}
    </div>
  )
}

