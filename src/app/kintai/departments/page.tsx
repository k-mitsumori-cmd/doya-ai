'use client'

import { useEffect, useState } from 'react'

const DEPT_BORDER_COLORS = [
  '#7f19e6', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#4f46e5', '#0d9488',
]

function getDeptBorderColor(index: number): string {
  return DEPT_BORDER_COLORS[index % DEPT_BORDER_COLORS.length]
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDepts = () => {
    setLoading(true)
    fetch('/api/kintai/departments')
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDepts() }, [])

  const openCreate = () => { setEditing(null); setName(''); setDescription(''); setShowForm(true) }
  const openEdit = (dept: any) => { setEditing(dept); setName(dept.name); setDescription(dept.description || ''); setShowForm(true) }

  const handleSave = async () => {
    if (!name.trim()) { alert('部署名を入力してください'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/kintai/departments/${editing.id}` : '/api/kintai/departments'
      const method = editing ? 'PATCH' : 'POST'
      const body: any = { name }
      if (description.trim()) body.description = description
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); alert(d.error || '保存に失敗しました'); return }
      setShowForm(false)
      fetchDepts()
    } catch { alert('通信エラー') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/kintai/departments/${showDeleteConfirm.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error || '削除に失敗しました'); return }
      setShowDeleteConfirm(null)
      fetchDepts()
    } catch { alert('通信エラー') } finally { setDeleting(false) }
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800">部署管理</h1>
          {!loading && (
            <span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
              全{departments.length}部署
            </span>
          )}
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-[#7f19e6] text-white text-sm font-bold rounded-lg hover:bg-[#6a14c2] transition-colors">
          <span className="material-symbols-outlined text-lg">add</span>部署を追加
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-[#7f19e6]/5 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-5xl text-[#7f19e6]/40">apartment</span>
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">部署がまだありません</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-xs">部署を作成して、従業員を組織構造に割り当てましょう。</p>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-5 py-2.5 bg-[#7f19e6] text-white text-sm font-bold rounded-lg hover:bg-[#6a14c2] transition-colors">
            <span className="material-symbols-outlined text-lg">add</span>最初の部署を作成しましょう
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map((dept, idx) => {
            const empCount = dept._count?.employees || 0
            const borderColor = getDeptBorderColor(idx)
            const hasChildren = departments.some((d: any) => d.parentId === dept.id)
            const hasParent = !!dept.parentId

            return (
              <div key={dept.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition-shadow">
                {/* Colored left border */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: borderColor }} />

                <div className="flex items-start justify-between pl-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {(hasChildren || hasParent) && (
                        <span className="material-symbols-outlined text-base text-slate-400" title={hasChildren ? '子部署あり' : '親部署あり'}>
                          {hasChildren ? 'account_tree' : 'subdirectory_arrow_right'}
                        </span>
                      )}
                      <h3 className="font-bold text-slate-800 truncate">{dept.name}</h3>
                    </div>
                    {dept.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{dept.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                        <span className="material-symbols-outlined text-base" style={{ color: borderColor }}>group</span>
                        <span className="font-medium">{empCount}</span>名
                      </span>
                      {empCount === 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">管理者未設定</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 ml-2 shrink-0">
                    <button onClick={() => openEdit(dept)} className="p-1.5 text-slate-400 hover:text-[#7f19e6] hover:bg-purple-50 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onClick={() => setShowDeleteConfirm(dept)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{editing ? '部署を編集' : '部署を追加'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                部署名 <span className="text-red-500">*</span>
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]"
                placeholder="例: 営業部" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                説明 <span className="text-xs text-slate-400 font-normal">（任意）</span>
              </label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] resize-none"
                placeholder="この部署に関するメモ..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#7f19e6] text-white font-bold rounded-xl hover:bg-[#6a14c2] transition-colors disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-600">warning</span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">部署を削除</h2>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-800">「{showDeleteConfirm.name}」</span>を削除しますか？
              </p>
              {(showDeleteConfirm._count?.employees || 0) > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">info</span>
                  <p className="text-xs text-amber-700">この部署には<span className="font-bold">{showDeleteConfirm._count.employees}名</span>の従業員が所属しています。削除すると所属が解除されます。</p>
                </div>
              )}
              <p className="text-xs text-slate-400">この操作は元に戻せません。</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
