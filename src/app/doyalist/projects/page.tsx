'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  description?: string | null
  industry?: string | null
  region?: string | null
  targetSize?: string | null
  status: string
  companyCount?: number
  approachCount?: number
  createdAt: string
  updatedAt: string
}

type StatusFilter = 'all' | 'active' | 'archived'

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // SWC parser bug workaround: avoid useState<'a'|'b'>() generic
  const [statusFilter, setStatusFilter] = useState('all' as StatusFilter)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/doyalist/projects')
      .then(async (r) => {
        const data = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setError(data?.error || 'プロジェクトを取得できませんでした')
          return
        }
        const list: Project[] =
          (Array.isArray(data) ? data : data?.projects) || []
        setProjects(
          list.map((p: any) => ({
            ...p,
            companyCount: p.companyCount ?? p._count?.companies ?? 0,
            approachCount: p.approachCount ?? p._count?.approaches ?? 0,
          })),
        )
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (q) {
        const t = `${p.name} ${p.description ?? ''} ${p.industry ?? ''} ${p.region ?? ''}`.toLowerCase()
        if (!t.includes(q)) return false
      }
      return true
    })
  }, [projects, query, statusFilter])

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800">プロジェクト</h1>
          <p className="text-sm text-slate-500 mt-1">営業対象企業のリストをプロジェクト単位で管理</p>
        </div>
        <Link
          href="/doyalist/projects/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-colors self-start lg:self-auto"
        >
          <span className="material-symbols-outlined">add</span>
          新規プロジェクト
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 text-lg">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="プロジェクト名や業界で検索..."
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'archived'] as StatusFilter[]).map((s) => {
            const label = s === 'all' ? 'すべて' : s === 'active' ? 'アクティブ' : 'アーカイブ'
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 text-xs font-bold rounded-full transition-all ${
                  active
                    ? 'bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/20'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState query={query} hasProjects={projects.length > 0} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const isArchived = project.status === 'archived'
  return (
    <Link
      href={`/doyalist/projects/${project.id}`}
      className={`group block rounded-3xl border bg-white p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
        isArchived ? 'border-slate-100 opacity-80' : 'border-slate-100 hover:border-purple-200'
      }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isArchived
              ? 'bg-slate-100 text-slate-400'
              : 'bg-gradient-to-br from-purple-100 to-violet-100 text-[#7f19e6]'
          }`}
        >
          <span className="material-symbols-outlined">{isArchived ? 'inventory_2' : 'folder'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-base font-black truncate ${
              isArchived ? 'text-slate-500' : 'text-slate-800 group-hover:text-[#7f19e6]'
            } transition-colors`}
          >
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {project.industry && (
          <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">
            {project.industry}
          </span>
        )}
        {project.region && (
          <span className="text-[10px] font-bold px-2 py-0.5 bg-fuchsia-50 text-fuchsia-600 rounded-full">
            {project.region}
          </span>
        )}
        {project.targetSize && (
          <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-[#7f19e6] rounded-full">
            {project.targetSize}
          </span>
        )}
      </div>

      {/* Counts */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-slate-300 text-base">apartment</span>
            <span className="text-sm font-black text-slate-700">{project.companyCount ?? 0}</span>
            <span className="text-[10px] font-bold text-slate-400">社</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-slate-300 text-base">mail</span>
            <span className="text-sm font-black text-slate-700">{project.approachCount ?? 0}</span>
            <span className="text-[10px] font-bold text-slate-400">件</span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400">
          {new Date(project.createdAt).toLocaleDateString('ja-JP')}
        </span>
      </div>
    </Link>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 animate-pulse">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-50 rounded w-1/2" />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="h-5 w-12 bg-slate-50 rounded-full" />
            <div className="h-5 w-12 bg-slate-50 rounded-full" />
          </div>
          <div className="h-8 bg-slate-50 rounded" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ query, hasProjects }: { query: string; hasProjects: boolean }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-[#7f19e6] mb-4">
        <span className="material-symbols-outlined" style={{ fontSize: 40 }}>
          {query || hasProjects ? 'search_off' : 'folder_open'}
        </span>
      </div>
      <h3 className="text-lg font-black text-slate-700 mb-1">
        {query
          ? '該当するプロジェクトがありません'
          : hasProjects
            ? 'フィルター条件に一致するプロジェクトがありません'
            : 'まだプロジェクトがありません'}
      </h3>
      <p className="text-sm text-slate-400 mb-5">
        {query || hasProjects
          ? '検索条件を変更してください'
          : '最初のプロジェクトを作成して始めましょう'}
      </p>
      {!hasProjects && (
        <Link
          href="/doyalist/projects/new"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7f19e6] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          新規プロジェクト
        </Link>
      )}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-16">
      <span className="material-symbols-outlined text-rose-400 text-6xl">error</span>
      <h3 className="text-lg font-black text-slate-700 mt-3 mb-1">読み込みに失敗しました</h3>
      <p className="text-sm text-rose-600 mb-5">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7f19e6] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-colors"
      >
        再試行
      </button>
    </div>
  )
}
