'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Company {
  id: string
  name: string
  industry?: string | null
  region?: string | null
  size?: string | null
  website?: string | null
  score?: number | null
  status: string
  contactEmail?: string | null
  contactPerson?: string | null
  notes?: string | null
  createdAt: string
}

interface Project {
  id: string
  name: string
  description?: string | null
  industry?: string | null
  region?: string | null
  targetSize?: string | null
  keywords?: string | null
  status: string
  companies?: Company[]
  createdAt: string
}

const COMPANY_STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'new', label: '新規', color: 'bg-slate-100 text-slate-600' },
  { value: 'contacted', label: 'コンタクト済み', color: 'bg-purple-100 text-purple-700' },
  { value: 'replied', label: '返信あり', color: 'bg-amber-100 text-amber-700' },
  { value: 'won', label: '受注', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'lost', label: '失注', color: 'bg-rose-100 text-rose-600' },
]

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = (params?.id as string) || ''

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCollectModal, setShowCollectModal] = useState(false)
  const [collectCount, setCollectCount] = useState(20)
  const [collecting, setCollecting] = useState(false)
  // SWC parser bug workaround
  const [statusFilter, setStatusFilter] = useState('all' as string)

  const load = () => {
    setLoading(true)
    fetch(`/api/doyalist/projects/${projectId}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'プロジェクトを取得できませんでした')
        setProject(data?.project || data)
      })
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (projectId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const companies = project?.companies || []

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { total: companies.length }
    COMPANY_STATUS_OPTIONS.forEach((s) => (counts[s.value] = 0))
    companies.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1
    })
    return counts
  }, [companies])

  const filteredCompanies = useMemo(() => {
    if (statusFilter === 'all') return companies
    return companies.filter((c) => c.status === statusFilter)
  }, [companies, statusFilter])

  const handleCollect = async () => {
    setCollecting(true)
    const id = toast.loading('AIが企業を収集中...（最大数分かかります）')
    try {
      const res = await fetch('/api/doyalist/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, count: collectCount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '収集に失敗しました')
      toast.success(`${data?.companiesCollected ?? collectCount}社を収集しました`, { id })
      setShowCollectModal(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || '収集に失敗しました', { id })
    } finally {
      setCollecting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('このプロジェクトを削除します。本当によろしいですか?')) return
    const id = toast.loading('削除中...')
    try {
      const res = await fetch(`/api/doyalist/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('プロジェクトを削除しました', { id })
      router.push('/doyalist/projects')
    } catch (e: any) {
      toast.error(e?.message || '削除に失敗しました', { id })
    }
  }

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('この企業を削除しますか?')) return
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      load()
    } catch (e: any) {
      toast.error(e?.message || '削除に失敗しました')
    }
  }

  const handleEnrich = async (companyId: string) => {
    const id = toast.loading('AI分析を実行中...')
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}/enrich`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'AI分析に失敗しました')
      toast.success('AI分析が完了しました', { id })
      load()
    } catch (e: any) {
      toast.error(e?.message || '分析に失敗しました', { id })
    }
  }

  const handleGenerateApproach = async (companyId: string) => {
    const id = toast.loading('アプローチ文面を生成中...')
    try {
      const res = await fetch('/api/doyalist/approach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, companyId, type: 'email' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '生成に失敗しました')
      toast.success('アプローチ文面を生成しました', { id })
      router.push(`/doyalist/projects/${projectId}/approach`)
    } catch (e: any) {
      toast.error(e?.message || '生成に失敗しました', { id })
    }
  }

  const handleExport = (format: 'csv' | 'excel') => {
    window.open(`/api/doyalist/export?projectId=${projectId}&format=${format}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        <p className="text-sm font-bold text-slate-400">プロジェクトを読み込み中...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <span className="material-symbols-outlined text-rose-400 text-6xl">error</span>
        <h2 className="text-2xl font-black text-slate-800">プロジェクトを読み込めません</h2>
        <p className="text-sm text-rose-600 max-w-lg text-center">{error || '不明なエラー'}</p>
        <Link
          href="/doyalist/projects"
          className="px-6 py-3 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
        >
          一覧に戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-20">
      {/* Breadcrumb */}
      <Link
        href="/doyalist/projects"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#7f19e6] transition-colors mb-3"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        プロジェクト一覧
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 truncate">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 mt-1">{project.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {project.industry && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full">
                {project.industry}
              </span>
            )}
            {project.region && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-fuchsia-50 text-fuchsia-600 rounded-full">
                {project.region}
              </span>
            )}
            {project.targetSize && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-purple-50 text-[#7f19e6] rounded-full">
                {project.targetSize}
              </span>
            )}
            {project.keywords &&
              project.keywords
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
                .map((k) => (
                  <span
                    key={k}
                    className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full"
                  >
                    #{k}
                  </span>
                ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/doyalist/projects/${projectId}/approach`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">mail</span>
            アプローチ管理
          </Link>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            削除
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <StatPill label="企業数" value={statusCounts.total} color="bg-[#7f19e6] text-white" big />
        {COMPANY_STATUS_OPTIONS.map((s) => (
          <StatPill key={s.value} label={s.label} value={statusCounts[s.value] || 0} color={s.color} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <button
          onClick={() => setShowCollectModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors"
        >
          <span className="material-symbols-outlined">travel_explore</span>
          企業を収集
        </button>
        <div className="flex gap-2 sm:ml-auto">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">download</span>
            CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-base">table_view</span>
            Excel
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <FilterPill
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label={`すべて (${statusCounts.total})`}
        />
        {COMPANY_STATUS_OPTIONS.map((s) => (
          <FilterPill
            key={s.value}
            active={statusFilter === s.value}
            onClick={() => setStatusFilter(s.value)}
            label={`${s.label} (${statusCounts[s.value] || 0})`}
          />
        ))}
      </div>

      {/* Companies table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredCompanies.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-[#7f19e6] mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
                apartment
              </span>
            </div>
            <h3 className="text-base font-black text-slate-700 mb-1">
              {companies.length === 0 ? 'まだ企業がありません' : '条件に一致する企業がありません'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              「企業を収集」でAIに企業リストを生成させましょう
            </p>
            <button
              onClick={() => setShowCollectModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7f19e6] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-colors"
            >
              <span className="material-symbols-outlined">travel_explore</span>
              企業を収集
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left">
                  <Th>企業名</Th>
                  <Th>業界</Th>
                  <Th>地域</Th>
                  <Th>規模</Th>
                  <Th>スコア</Th>
                  <Th>ステータス</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map((c) => {
                  const status =
                    COMPANY_STATUS_OPTIONS.find((s) => s.value === c.status) ||
                    COMPANY_STATUS_OPTIONS[0]
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <Td>
                        <Link
                          href={`/doyalist/projects/${projectId}/company/${c.id}`}
                          className="font-black text-slate-800 hover:text-[#7f19e6] transition-colors"
                        >
                          {c.name}
                        </Link>
                        {c.website && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{c.website}</p>
                        )}
                      </Td>
                      <Td className="text-slate-600">{c.industry || '-'}</Td>
                      <Td className="text-slate-600">{c.region || '-'}</Td>
                      <Td className="text-slate-600">{c.size || '-'}</Td>
                      <Td>
                        {c.score != null ? (
                          <ScoreBadge score={c.score} />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <IconBtn
                            icon="visibility"
                            label="詳細"
                            href={`/doyalist/projects/${projectId}/company/${c.id}`}
                          />
                          <IconBtn
                            icon="psychology"
                            label="AI分析"
                            onClick={() => handleEnrich(c.id)}
                            color="text-violet-500 hover:bg-violet-50"
                          />
                          <IconBtn
                            icon="mail"
                            label="アプローチ生成"
                            onClick={() => handleGenerateApproach(c.id)}
                            color="text-[#7f19e6] hover:bg-purple-50"
                          />
                          <IconBtn
                            icon="delete"
                            label="削除"
                            onClick={() => handleDeleteCompany(c.id)}
                            color="text-rose-500 hover:bg-rose-50"
                          />
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Modal */}
      {showCollectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center text-[#7f19e6]">
                <span className="material-symbols-outlined">travel_explore</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">企業を収集</h2>
                <p className="text-xs text-slate-500">
                  AIがプロジェクト条件に合う企業を集めます
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">収集する件数</label>
              <input
                type="number"
                min={1}
                max={200}
                value={collectCount}
                onChange={(e) =>
                  setCollectCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6]"
              />
              <div className="flex gap-1.5 mt-2">
                {[10, 20, 50, 100].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCollectCount(n)}
                    className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-[#7f19e6] transition-colors"
                  >
                    {n}件
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCollectModal(false)}
                disabled={collecting}
                className="flex-1 px-4 py-3 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCollect}
                disabled={collecting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] disabled:bg-slate-300 text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors"
              >
                {collecting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    収集中...
                  </>
                ) : (
                  '収集を開始'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
  big,
}: {
  label: string
  value: number
  color: string
  big?: boolean
}) {
  const isFullColor = color.includes('bg-') && color.includes('text-white')
  return (
    <div
      className={`rounded-2xl px-4 py-3 ${
        isFullColor ? color : `bg-white border border-slate-100 ${color}`
      }`}
    >
      <p
        className={`text-[10px] font-bold ${
          isFullColor ? 'opacity-80' : 'text-slate-500'
        }`}
      >
        {label}
      </p>
      <p className={`font-black ${big ? 'text-2xl' : 'text-xl'}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all ${
        active
          ? 'bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/20'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : score >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-500'
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full ${color}`}
    >
      <span className="material-symbols-outlined text-sm">star</span>
      {score}
    </span>
  )
}

function IconBtn({
  icon,
  label,
  onClick,
  href,
  color = 'text-slate-500 hover:bg-slate-100',
}: {
  icon: string
  label: string
  onClick?: () => void
  href?: string
  color?: string
}) {
  const base = `inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${color}`
  if (href) {
    return (
      <Link href={href} title={label} className={base}>
        <span className="material-symbols-outlined text-base">{icon}</span>
      </Link>
    )
  }
  return (
    <button onClick={onClick} title={label} className={base}>
      <span className="material-symbols-outlined text-base">{icon}</span>
    </button>
  )
}
