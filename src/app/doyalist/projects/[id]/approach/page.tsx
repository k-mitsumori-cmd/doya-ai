'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Company {
  id: string
  name: string
}

interface Approach {
  id: string
  projectId: string
  companyId?: string | null
  company?: Company | null
  type: string
  subject?: string | null
  body: string
  status: string
  createdAt: string
}

interface Project {
  id: string
  name: string
  companies?: Company[]
  approaches?: Approach[]
}

const TYPE_OPTIONS = [
  { value: 'email', label: 'メール', icon: 'mail', color: 'bg-purple-100 text-purple-700' },
  { value: 'dm', label: 'DM', icon: 'forum', color: 'bg-violet-100 text-violet-700' },
  { value: 'phone', label: '電話', icon: 'call', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'letter', label: '手紙', icon: 'description', color: 'bg-amber-100 text-amber-700' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: '下書き', color: 'bg-slate-100 text-slate-600' },
  { value: 'sent', label: '送信済み', color: 'bg-purple-100 text-purple-700' },
  { value: 'replied', label: '返信あり', color: 'bg-emerald-100 text-emerald-700' },
]

export default function ApproachPage() {
  const params = useParams()
  const projectId = (params?.id as string) || ''

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  // SWC parser bug workarounds
  const [typeFilter, setTypeFilter] = useState('all' as string)
  const [statusFilter, setStatusFilter] = useState('all' as string)
  const [companyFilter, setCompanyFilter] = useState('all' as string)
  const [editing, setEditing] = useState(null as Approach | null)

  // Bulk generation
  const [selectedCompanies, setSelectedCompanies] = useState([] as string[])
  const [bulkType, setBulkType] = useState('email')
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [showBulkPanel, setShowBulkPanel] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/doyalist/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => setProject(data?.project || data))
      .catch(() => toast.error('プロジェクトの読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (projectId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const approaches = project?.approaches || []
  const companies = project?.companies || []

  const filtered = useMemo(() => {
    return approaches.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (companyFilter !== 'all' && a.companyId !== companyFilter) return false
      return true
    })
  }, [approaches, typeFilter, statusFilter, companyFilter])

  const toggleCompany = (id: string) => {
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const handleBulkGenerate = async () => {
    if (selectedCompanies.length === 0) {
      toast.error('企業を選択してください')
      return
    }
    setBulkGenerating(true)
    const tid = toast.loading(`${selectedCompanies.length}社分を生成中...`)
    try {
      const res = await fetch('/api/doyalist/approach/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, companyIds: selectedCompanies, type: bulkType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '一括生成に失敗しました')
      toast.success(`${data?.generated ?? selectedCompanies.length}件を生成しました`, { id: tid })
      setSelectedCompanies([])
      setShowBulkPanel(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || '生成に失敗しました', { id: tid })
    } finally {
      setBulkGenerating(false)
    }
  }

  const handleUpdate = async (approachId: string, patch: Partial<Approach>) => {
    const tid = toast.loading('保存中...')
    try {
      const res = await fetch(`/api/doyalist/approach/${approachId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('更新しました', { id: tid })
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || '保存に失敗しました', { id: tid })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        <p className="text-sm font-bold text-slate-400">アプローチを読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-20">
      <Link
        href={`/doyalist/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#7f19e6] transition-colors mb-3"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {project?.name || 'プロジェクト'}に戻る
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800">アプローチ管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            生成された営業文面の管理・編集・一括生成
          </p>
        </div>
        <button
          onClick={() => setShowBulkPanel((v) => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors self-start lg:self-auto"
        >
          <span className="material-symbols-outlined">auto_awesome</span>
          一括生成
        </button>
      </div>

      {/* Bulk panel */}
      {showBulkPanel && (
        <div className="bg-white rounded-3xl border border-purple-200 shadow-lg p-6 mb-6">
          <h2 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">auto_awesome</span>
            一括アプローチ生成
          </h2>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-700 mb-2">タイプ</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setBulkType(t.value)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    bulkType === t.value
                      ? 'bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700">
                対象企業 ({selectedCompanies.length}/{companies.length}社選択)
              </label>
              <button
                onClick={() =>
                  setSelectedCompanies(
                    selectedCompanies.length === companies.length ? [] : companies.map((c) => c.id),
                  )
                }
                className="text-xs font-bold text-[#7f19e6] hover:underline"
              >
                {selectedCompanies.length === companies.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {companies.length === 0 ? (
                <p className="text-xs text-slate-400 p-3 col-span-2">企業がまだありません</p>
              ) : (
                companies.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(c.id)}
                      onChange={() => toggleCompany(c.id)}
                      className="w-4 h-4 rounded accent-[#7f19e6]"
                    />
                    <span className="text-sm font-medium text-slate-700 truncate">{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowBulkPanel(false)
                setSelectedCompanies([])
              }}
              className="px-5 py-2.5 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleBulkGenerate}
              disabled={bulkGenerating || selectedCompanies.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] disabled:bg-slate-300 text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors"
            >
              {bulkGenerating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  {selectedCompanies.length}社分を生成
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <FilterSelect
          label="タイプ"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'すべて' },
            ...TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label })),
          ]}
        />
        <FilterSelect
          label="ステータス"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'すべて' },
            ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        <FilterSelect
          label="企業"
          value={companyFilter}
          onChange={setCompanyFilter}
          options={[
            { value: 'all', label: 'すべて' },
            ...companies.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-[#7f19e6] mb-4">
            <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
              mail
            </span>
          </div>
          <h3 className="text-base font-black text-slate-700 mb-1">
            {approaches.length === 0
              ? 'まだアプローチがありません'
              : 'フィルター条件に一致するアプローチがありません'}
          </h3>
          <p className="text-sm text-slate-400">
            「一括生成」または企業詳細から個別に生成できます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const type = TYPE_OPTIONS.find((t) => t.value === a.type) || TYPE_OPTIONS[0]
            const status = STATUS_OPTIONS.find((s) => s.value === a.status) || STATUS_OPTIONS[0]
            return (
              <div
                key={a.id}
                className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${type.color}`}
                    >
                      <span className="material-symbols-outlined text-sm">{type.icon}</span>
                      {type.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.color}`}
                    >
                      {status.label}
                    </span>
                    {a.company && (
                      <span className="text-xs font-bold text-slate-700">{a.company.name}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditing(a)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    編集
                  </button>
                </div>
                {a.subject && (
                  <p className="text-sm font-black text-slate-800 mb-1">件名: {a.subject}</p>
                )}
                <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                  {a.body}
                </p>
                <p className="text-[10px] text-slate-400 mt-3">
                  作成: {new Date(a.createdAt).toLocaleString('ja-JP')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal
          approach={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => handleUpdate(editing.id, patch)}
        />
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function EditModal({
  approach,
  onClose,
  onSave,
}: {
  approach: Approach
  onClose: () => void
  onSave: (patch: Partial<Approach>) => void
}) {
  const [subject, setSubject] = useState(approach.subject || '')
  const [body, setBody] = useState(approach.body)
  const [status, setStatus] = useState(approach.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
        <h2 className="text-lg font-black text-slate-800 mb-4">アプローチを編集</h2>

        <div className="space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">件名</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">本文</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-5 mt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave({ subject, body, status })}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors"
          >
            <span className="material-symbols-outlined">save</span>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
