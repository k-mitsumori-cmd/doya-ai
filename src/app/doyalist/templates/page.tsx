'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  name: string
  type: string
  subject?: string | null
  body: string
  isDefault?: boolean
  createdAt: string
}

const TYPE_OPTIONS = [
  { value: 'email', label: 'メール', icon: 'mail', color: 'bg-purple-100 text-purple-700' },
  { value: 'dm', label: 'DM', icon: 'forum', color: 'bg-violet-100 text-violet-700' },
  { value: 'phone', label: '電話', icon: 'call', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'letter', label: '手紙', icon: 'description', color: 'bg-amber-100 text-amber-700' },
]

const EMPTY_FORM = { name: '', type: 'email', subject: '', body: '' }

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([] as Template[])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all' as string)
  const [editing, setEditing] = useState(null as Template | null)
  const [creating, setCreating] = useState(false)
  const [previewing, setPreviewing] = useState(null as Template | null)

  const load = () => {
    setLoading(true)
    fetch('/api/doyalist/templates')
      .then((r) => r.json())
      .then((data) => {
        const list: Template[] = Array.isArray(data) ? data : data?.templates || []
        setTemplates(list)
      })
      .catch(() => toast.error('テンプレートの読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return templates
    return templates.filter((t) => t.type === typeFilter)
  }, [templates, typeFilter])

  const handleSave = async (form: typeof EMPTY_FORM, existingId?: string) => {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('テンプレート名と本文は必須です')
      return
    }
    const tid = toast.loading('保存中...')
    try {
      const res = await fetch(
        existingId ? `/api/doyalist/templates/${existingId}` : '/api/doyalist/templates',
        {
          method: existingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('保存しました', { id: tid })
      setCreating(false)
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || '保存に失敗しました', { id: tid })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか?')) return
    const tid = toast.loading('削除中...')
    try {
      const res = await fetch(`/api/doyalist/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました', { id: tid })
      load()
    } catch (e: any) {
      toast.error(e?.message || '削除に失敗しました', { id: tid })
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800">テンプレート</h1>
          <p className="text-sm text-slate-500 mt-1">
            アプローチ文面のひな型を作成・再利用できます
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors self-start lg:self-auto"
        >
          <span className="material-symbols-outlined">add</span>
          新規テンプレート
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <FilterPill
          active={typeFilter === 'all'}
          onClick={() => setTypeFilter('all')}
          label={`すべて (${templates.length})`}
        />
        {TYPE_OPTIONS.map((t) => {
          const count = templates.filter((tt) => tt.type === t.value).length
          return (
            <FilterPill
              key={t.value}
              active={typeFilter === t.value}
              onClick={() => setTypeFilter(t.value)}
              icon={t.icon}
              label={`${t.label} (${count})`}
            />
          )
        })}
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center text-[#7f19e6] mb-4">
            <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
              description
            </span>
          </div>
          <h3 className="text-base font-black text-slate-700 mb-1">
            {templates.length === 0
              ? 'まだテンプレートがありません'
              : '該当するテンプレートがありません'}
          </h3>
          <p className="text-sm text-slate-400 mb-5">
            よく使う文面をひな型として登録しておきましょう
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7f19e6] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-colors"
          >
            <span className="material-symbols-outlined">add</span>
            新規テンプレート
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const type = TYPE_OPTIONS.find((tt) => tt.value === t.type) || TYPE_OPTIONS[0]
            return (
              <div
                key={t.id}
                className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${type.color}`}
                  >
                    <span className="material-symbols-outlined text-sm">{type.icon}</span>
                    {type.label}
                  </span>
                  {t.isDefault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      デフォルト
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-800 mb-1 line-clamp-1">{t.name}</h3>
                {t.subject && (
                  <p className="text-xs font-bold text-slate-500 mb-1 line-clamp-1">
                    件名: {t.subject}
                  </p>
                )}
                <p className="text-xs text-slate-500 mb-4 line-clamp-3 leading-relaxed flex-1">
                  {t.body}
                </p>
                <div className="flex gap-1 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setPreviewing(t)}
                    aria-label={`テンプレート「${t.name}」をプレビュー`}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">visibility</span>
                    プレビュー
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    aria-label={`テンプレート「${t.name}」を編集`}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-[#7f19e6] hover:bg-purple-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="削除"
                    aria-label={`テンプレート「${t.name}」を削除`}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {(creating || editing) && (
        <TemplateModal
          template={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {/* Preview modal */}
      {previewing && (
        <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />
      )}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all ${
        active
          ? 'bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/20'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
      {label}
    </button>
  )
}

function TemplateModal({
  template,
  onClose,
  onSave,
}: {
  template: Template | null
  onClose: () => void
  onSave: (form: typeof EMPTY_FORM, id?: string) => void
}) {
  const [form, setForm] = useState({
    name: template?.name || '',
    type: template?.type || 'email',
    subject: template?.subject || '',
    body: template?.body || '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
        <h2 className="text-lg font-black text-slate-800 mb-4">
          {template ? 'テンプレートを編集' : '新規テンプレート'}
        </h2>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              名前 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例：初回アプローチメール"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">タイプ</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: t.value })}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    form.type === t.value
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">件名（任意）</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="メール件名など"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              本文 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              placeholder="本文のひな型を入力..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all resize-y"
            />
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
            onClick={() => onSave(form, template?.id)}
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

function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const type = TYPE_OPTIONS.find((t) => t.value === template.type) || TYPE_OPTIONS[0]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${type.color}`}
            >
              <span className="material-symbols-outlined text-sm">{type.icon}</span>
              {type.label}
            </span>
            <h2 className="text-lg font-black text-slate-800">{template.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>

        <div className="overflow-y-auto space-y-4">
          {template.subject && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">件名</p>
              <p className="text-sm font-black text-slate-800 bg-slate-50 px-4 py-3 rounded-2xl">
                {template.subject}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">本文</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 px-4 py-3 rounded-2xl">
              {template.body}
            </p>
          </div>
        </div>

        <div className="pt-5 mt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
