'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import ProjectCard, { type ProjectCardProps } from '@/components/tenkai/ProjectCard'

// ============================================
// ソートオプション
// ============================================
type SortOption = 'newest' | 'oldest' | 'score' | 'name'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '新しい順' },
  { value: 'oldest', label: '古い順' },
  { value: 'score', label: 'スコア順' },
  { value: 'name', label: '名前順' },
]

// ============================================
// スケルトンカード
// ============================================
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-5 bg-slate-100 rounded-full w-16" />
        <div className="h-5 bg-slate-100 rounded-full w-20" />
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 bg-slate-100 rounded w-24" />
          <div className="h-3 bg-slate-100 rounded w-16" />
        </div>
        <div className="flex items-center justify-between gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="mt-4 pt-3">
        <div className="h-10 bg-slate-100 rounded-full" />
      </div>
    </div>
  )
}

// ============================================
// Projects Page
// ============================================
export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCardProps[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [notifications] = useState(0)

  // ============================================
  // データ取得
  // ============================================
  const fetchProjects = useCallback(async (pageNum: number, append = false) => {
    try {
      if (!append) setLoading(true)
      else setLoadingMore(true)

      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '9',
        sort: sortBy,
        ...(search && { search }),
      })

      const res = await fetch(`/api/tenkai/projects?${params}`)
      if (!res.ok) throw new Error('プロジェクトの取得に失敗しました')

      const data = await res.json()
      const fetched: ProjectCardProps[] = data.projects || []

      if (append) {
        setProjects((prev) => [...prev, ...fetched])
      } else {
        setProjects(fetched)
      }

      setHasMore(data.hasMore ?? false)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sortBy, search])

  useEffect(() => {
    setPage(1)
    fetchProjects(1)
  }, [fetchProjects])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchProjects(nextPage, true)
  }

  // ============================================
  // 削除
  // ============================================
  const handleDelete = async (projectId: string) => {
    try {
      const res = await fetch(`/api/tenkai/projects/${projectId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('プロジェクトの削除に失敗しました')
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  // ============================================
  // フィルタリング（クライアント側）
  // ============================================
  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {/* ======== Sticky Header ======== */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            {/* 検索バー */}
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="プロジェクトを検索..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100/80 border border-transparent focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
              />
            </div>

            {/* ソートボタン */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 text-sm font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-lg">sort</span>
                <span className="hidden sm:inline">
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </span>
              </button>

              <AnimatePresence>
                {showSortMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 z-20 w-40 bg-white rounded-xl border border-slate-200 shadow-xl py-1"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value)
                            setShowSortMenu(false)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            sortBy === option.value
                              ? 'text-blue-600 bg-blue-50 font-semibold'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* 通知ボタン */}
            <button className="relative p-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 transition-colors">
              <span className="material-symbols-outlined text-xl">notifications</span>
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </button>

            {/* 新規プロジェクトボタン */}
            <Link
              href="/tenkai/create"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span className="hidden sm:inline">新規プロジェクト</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ======== Page Content ======== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* タイトル */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">アクティブプロジェクト</h1>
          <p className="text-sm text-slate-500 mt-1">
            コンテンツを作成し、9つのプラットフォームに展開しましょう
          </p>
        </div>

        {/* ======== Loading State ======== */}
        {loading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ======== Error State ======== */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-red-400">error</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">エラーが発生しました</h3>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <button
              onClick={() => fetchProjects(1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              再試行
            </button>
          </motion.div>
        )}

        {/* ======== Empty State ======== */}
        {!loading && !error && filteredProjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-blue-400">
                rocket_launch
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {search ? '検索結果がありません' : 'まだプロジェクトがありません'}
            </h3>
            <p className="text-sm text-slate-500 mb-8 max-w-md text-center">
              {search
                ? `「${search}」に一致するプロジェクトが見つかりませんでした。検索条件を変更してお試しください。`
                : '最初のプロジェクトを作成して、1つのコンテンツを9つのプラットフォームに展開しましょう。'}
            </p>
            {!search && (
              <Link
                href="/tenkai/create"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                <span className="material-symbols-outlined">add</span>
                最初のプロジェクトを作成
              </Link>
            )}
          </motion.div>
        )}

        {/* ======== Project Grid ======== */}
        {!loading && !error && filteredProjects.length > 0 && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <ProjectCard {...project} onDelete={handleDelete} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* もっと読み込むボタン */}
            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <span className="material-symbols-outlined text-lg animate-spin">
                        progress_activity
                      </span>
                      読み込み中...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">expand_more</span>
                      もっと読み込む
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
