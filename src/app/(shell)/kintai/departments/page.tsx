'use client'

import { PageTitle } from '@/components/kintai/ui-next'
import { useEffect, useId, useRef, useState } from 'react'
import { Skeleton } from '@/components/ds'
import { alertDialog, ConfirmDialog } from '@/components/ds/dialog'
import { useEscapeToClose } from '@/lib/kintai/use-escape'
import { userErrorMessage, KINTAI_NETWORK_ERROR } from '@/lib/kintai/user-error'

const DEPT_BORDER_COLORS = [
  '#0066ff', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#0066ff', '#db2777', '#4f46e5', '#0d9488',
]

function getDeptBorderColor(index: number): string {
  return DEPT_BORDER_COLORS[index % DEPT_BORDER_COLORS.length]
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const requestVersion = useRef(0)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const formTitleId = useId()
  useEscapeToClose(showForm, () => setShowForm(false), saving)

  const fetchDepts = async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setLoadError(false)
    setDepartments([])
    try {
      const response = await fetch('/api/kintai/departments', { cache: 'no-store' })
      if (!response.ok) throw new Error('部署情報を読み込めませんでした')
      const data = await response.json()
      if (!Array.isArray(data?.departments)) throw new Error('部署情報を読み込めませんでした')
      if (version === requestVersion.current) setDepartments(data.departments)
    } catch {
      if (version === requestVersion.current) setLoadError(true)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDepts()
    return () => { requestVersion.current += 1 }
  }, [])

  const openCreate = () => { setEditing(null); setName(''); setShowForm(true) }
  const openEdit = (dept: any) => { setEditing(dept); setName(dept.name); setShowForm(true) }

  const handleSave = async () => {
    if (!name.trim()) { await alertDialog({ title: '部署名を入力してください', message: '部署名は必須です。例: 営業部', tone: 'error' }); return }
    setSaving(true)
    try {
      const url = editing ? `/api/kintai/departments/${editing.id}` : '/api/kintai/departments'
      const method = editing ? 'PATCH' : 'POST'
      const body: any = { name }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); await alertDialog({ title: '保存できませんでした', message: userErrorMessage(d?.error, '入力を確かめて、もう一度お試しください。'), tone: 'error' }); return }
      setShowForm(false)
      void fetchDepts()
    } catch { await alertDialog({ title: '保存できませんでした', message: KINTAI_NETWORK_ERROR, tone: 'error' }) } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/kintai/departments/${showDeleteConfirm.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setShowDeleteConfirm(null); await alertDialog({ title: '削除できませんでした', message: userErrorMessage(d?.error, '少し待って、もう一度お試しください。'), tone: 'error' }); return }
      setShowDeleteConfirm(null)
      void fetchDepts()
    } catch { setShowDeleteConfirm(null); await alertDialog({ title: '削除できませんでした', message: KINTAI_NETWORK_ERROR, tone: 'error' }) } finally { setDeleting(false) }
  }

  return (
    <>

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/kintai/characters/present_%E3%83%97%E3%83%AC%E3%82%BC%E3%83%B3.png" alt="くまさん" width={80} height={80} className="bear-float" />
            <div>
              <PageTitle className="text-2xl font-black text-slate-800">部署管理</PageTitle>
              {!loading && !loadError && (
                <span className="text-sm text-slate-500">
                  全<span className="font-bold text-[#0066ff]">{departments.length}</span>部署
                </span>
              )}
            </div>
          </div>
          <button onClick={openCreate} disabled={loading || loadError} className="flex items-center gap-2 px-5 py-3 bg-[#0066ff] text-white text-base font-black rounded-full hover:bg-[#0047d6] transition-all shadow-lg shadow-[#0066ff]/20 disabled:opacity-50">
            <span className="material-symbols-outlined text-xl">add</span>部署を追加
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true" aria-label="部署を読み込み中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-slate-200 p-5"><Skeleton lines={2} height={16} /></div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            部署情報を読み込めませんでした。通信を確かめて、もう一度お試しください。
            <button type="button" onClick={() => void fetchDepts()} className="ml-2 font-bold underline">再読み込み</button>
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center fade-in-up">
            <img src="/kintai/characters/hello_%E6%8C%A8%E6%8B%B6.png" alt="" width={120} height={120} className="bear-bounce mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">部署がまだありません</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">最初の部署を作成しましょう！</p>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0066ff] text-white text-sm font-bold rounded-lg hover:bg-[#0047d6] transition-colors">
              <span className="material-symbols-outlined text-lg">add</span>最初の部署を作成
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
                <div key={dept.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-md p-5 relative overflow-hidden hover:shadow-xl hover:border-brand-200 transition-all">
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
                        <h3 className="text-lg font-black text-slate-800 truncate">{dept.name}</h3>
                      </div>
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="inline-flex items-center gap-1.5 text-base text-slate-600">
                          <span className="material-symbols-outlined text-xl" style={{ color: borderColor }}>group</span>
                          <span className="font-black text-lg">{empCount}</span>名
                        </span>
                        {empCount === 0 && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">管理者未設定</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5 ml-2 shrink-0">
                      <button type="button" aria-label={`${dept.name}を編集する`} onClick={() => openEdit(dept)} className="p-1.5 text-slate-400 hover:text-[#0066ff] hover:bg-brand-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button type="button" aria-label={`${dept.name}を削除する`} onClick={() => setShowDeleteConfirm(dept)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby={formTitleId} className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/kintai/characters/point_%E8%A7%A3%E8%AA%AC.png" alt="" width={40} height={40} className="bear-wiggle" />
                  <h2 id={formTitleId} className="text-lg font-bold text-slate-800">{editing ? '部署を編集' : '部署を追加'}</h2>
                </div>
                <button type="button" aria-label="閉じる" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  部署名 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff]"
                  placeholder="例: 営業部" autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#0066ff] text-white font-bold rounded-xl hover:bg-[#0047d6] transition-colors disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 削除の確認（共通のダイアログ） */}
        <ConfirmDialog
          open={!!showDeleteConfirm}
          title={showDeleteConfirm ? `「${showDeleteConfirm.name}」を削除しますか？` : ''}
          message={(showDeleteConfirm?._count?.employees || 0) > 0
            ? `この部署には${showDeleteConfirm._count.employees}名の従業員が所属しています。先に従業員の所属を変えてください。元に戻せません。`
            : '元に戻せません。'}
          confirmLabel={deleting ? '削除中…' : '削除する'}
          tone="danger"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      </div>
    </>
  )
}
