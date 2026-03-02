'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Clock, ChevronRight, Plus, Search } from 'lucide-react'

interface CopyProject {
  id: string
  name: string
  status: string
  createdAt: string
  _count?: { copies: number }
}

export default function CopyHistoryPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<CopyProject[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const isLoggedIn = !!session?.user

  useEffect(() => {
    if (isLoggedIn) fetchProjects(0)
  }, [isLoggedIn])

  const fetchProjects = async (off = 0) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/copy/projects?limit=${limit}&offset=${off}`)
      if (res.ok) {
        const data = await res.json()
        const newProjects = data.projects || []
        setProjects(prev => off === 0 ? newProjects : [...prev, ...newProjects])
        setTotal(data.total || 0)
        setOffset(off + limit)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ログインして生成履歴を確認しましょう</p>
          <Link
            href="/api/auth/signin?callbackUrl=/copy/history"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl"
          >
            ログイン
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-600" />
              生成履歴
            </h1>
            <p className="text-gray-500 text-sm mt-1">全 {total} プロジェクト</p>
          </div>
          <Link
            href="/copy/new"
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規生成
          </Link>
        </div>

        {/* 検索 */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="プロジェクト名で検索..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {loading && projects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-gray-500 mb-4">
              {search ? '検索結果がありません' : 'まだプロジェクトがありません'}
            </p>
            {!search && (
              <Link
                href="/copy/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                最初のコピーを生成する
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((project) => (
              <Link
                key={project.id}
                href={`/copy/${project.id}`}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                <div>
                  <p className="font-bold text-gray-900">{project.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(project.createdAt).toLocaleDateString('ja-JP')} ·{' '}
                    {project._count?.copies ?? 0}件のコピー
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </Link>
            ))}

            {projects.length < total && (
              <button
                onClick={() => fetchProjects(offset)}
                disabled={loading}
                className="w-full py-3 text-sm text-amber-600 hover:text-amber-500 transition-colors"
              >
                {loading ? '読み込み中...' : 'さらに読み込む'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
