'use client'

import { useEffect, useState, useMemo } from 'react'
import { ROLE_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/kintai/types'

// Department colors for avatar circles
const DEPT_COLORS = [
  '#7f19e6', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#4f46e5', '#0d9488',
]

function getDeptColor(deptId: string | null): string {
  if (!deptId) return '#94a3b8'
  let hash = 0
  for (let i = 0; i < deptId.length; i++) hash = deptId.charCodeAt(i) + ((hash << 5) - hash)
  return DEPT_COLORS[Math.abs(hash) % DEPT_COLORS.length]
}

function formatHireDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [workRules, setWorkRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | 'active' | 'inactive'>('')
  const [filterEmploymentType, setFilterEmploymentType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', nameKana: '', email: '', departmentId: '', workRuleId: '', employmentType: 'full_time', hireDate: '', role: 'employee' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/kintai/employees').then(r => r.json()),
      fetch('/api/kintai/departments').then(r => r.json()),
      fetch('/api/kintai/work-rules').then(r => r.json()),
    ]).then(([empData, deptData, ruleData]) => {
      setEmployees(empData.employees || [])
      setDepartments(deptData.departments || [])
      setWorkRules(ruleData.rules || [])
    }).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', nameKana: '', email: '', departmentId: '', workRuleId: '', employmentType: 'full_time', hireDate: '', role: 'employee' })
    setErrors({})
    setShowForm(true)
  }

  const openEdit = (emp: any) => {
    setEditing(emp)
    setForm({
      name: emp.name, nameKana: emp.nameKana || '', email: emp.email,
      departmentId: emp.departmentId || '', workRuleId: emp.workRuleId || '',
      employmentType: emp.employmentType, hireDate: emp.hireDate ? emp.hireDate.split('T')[0] : '',
      role: emp.member?.role || 'employee',
    })
    setErrors({})
    setShowForm(true)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = '氏名は必須です'
    if (!form.email.trim()) errs.email = 'メールアドレスは必須です'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '正しいメールアドレスを入力してください'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const url = editing ? `/api/kintai/employees/${editing.id}` : '/api/kintai/employees'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); alert(d.error || '保存に失敗しました'); return }
      setShowForm(false)
      fetchAll()
    } catch { alert('通信エラー') } finally { setSaving(false) }
  }

  const toggleActive = async (emp: any) => {
    const action = emp.isActive ? '無効化' : '有効化'
    if (!window.confirm(`${emp.name}を${action}しますか？`)) return
    await fetch(`/api/kintai/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !emp.isActive }),
    })
    fetchAll()
  }

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (search && !e.name.includes(search) && !e.email.includes(search) && !(e.nameKana && e.nameKana.includes(search))) return false
      if (filterDept && e.departmentId !== filterDept) return false
      if (filterStatus === 'active' && !e.isActive) return false
      if (filterStatus === 'inactive' && e.isActive) return false
      if (filterEmploymentType && e.employmentType !== filterEmploymentType) return false
      return true
    })
  }, [employees, search, filterDept, filterStatus, filterEmploymentType])

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.isActive).length,
    inactive: employees.filter(e => !e.isActive).length,
  }), [employees])

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = []
    if (filterDept) {
      const dept = departments.find(d => d.id === filterDept)
      chips.push({ key: 'dept', label: `部署: ${dept?.name || filterDept}` })
    }
    if (filterStatus) chips.push({ key: 'status', label: `状態: ${filterStatus === 'active' ? '有効' : '無効'}` })
    if (filterEmploymentType) chips.push({ key: 'employment', label: `雇用: ${EMPLOYMENT_TYPE_LABELS[filterEmploymentType] || filterEmploymentType}` })
    return chips
  }, [filterDept, filterStatus, filterEmploymentType, departments])

  const clearFilter = (key: string) => {
    if (key === 'dept') setFilterDept('')
    if (key === 'status') setFilterStatus('')
    if (key === 'employment') setFilterEmploymentType('')
  }

  const clearAllFilters = () => {
    setSearch('')
    setFilterDept('')
    setFilterStatus('')
    setFilterEmploymentType('')
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-slate-800">従業員管理</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-[#7f19e6] text-white text-sm font-bold rounded-lg hover:bg-[#6a14c2] transition-colors">
          <span className="material-symbols-outlined text-lg">person_add</span>新規登録
        </button>
      </div>

      {/* Stats cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7f19e6]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#7f19e6]">groups</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
              <p className="text-xs text-slate-500">全従業員</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600">check_circle</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.active}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
              <p className="text-xs text-green-600">有効</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-400">person_off</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.inactive}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
              <p className="text-xs text-slate-400">無効</p>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-lg">search</span>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メール・カナで検索..."
            className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white">
          <option value="">全部署</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white">
          <option value="">全状態</option>
          <option value="active">有効</option>
          <option value="inactive">無効</option>
        </select>
        <select value={filterEmploymentType} onChange={e => setFilterEmploymentType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white">
          <option value="">全雇用形態</option>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">絞り込み中:</span>
          {activeFilters.map(chip => (
            <span key={chip.key} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#7f19e6]/10 text-[#7f19e6] text-xs font-medium rounded-full">
              {chip.label}
              <button onClick={() => clearFilter(chip.key)} className="hover:bg-[#7f19e6]/20 rounded-full p-0.5">
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </span>
          ))}
          <button onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-slate-700 underline">すべてクリア</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">person_search</span>
          {employees.length === 0 ? '従業員が登録されていません' : '条件に一致する従業員がいません'}
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-500 px-1">{filtered.length}件表示{filtered.length !== employees.length ? ` / 全${employees.length}件` : ''}</div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">氏名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">メール</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">部署</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">権限</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">雇用形態</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">入社日</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">状態</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, idx) => (
                  <tr key={emp.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: getDeptColor(emp.departmentId) }}
                        >
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 leading-tight">{emp.name}</p>
                          {emp.nameKana && <p className="text-xs text-slate-400 leading-tight">{emp.nameKana}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.email}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.department?.name || <span className="text-slate-300">-</span>}</td>
                    <td className="px-4 py-3 text-center"><span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full">{ROLE_LABELS[emp.member?.role] || emp.member?.role}</span></td>
                    <td className="px-4 py-3 text-center"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}</span></td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{formatHireDate(emp.hireDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {emp.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(emp)} className="p-1.5 text-slate-400 hover:text-[#7f19e6] hover:bg-purple-50 rounded-lg transition-colors" title="編集">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => toggleActive(emp)}
                          className={`p-1.5 rounded-lg transition-colors ${emp.isActive ? 'text-green-500 hover:text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:text-green-500 hover:bg-green-50'}`}
                          title={emp.isActive ? '無効化する' : '有効化する'}
                        >
                          <span className="material-symbols-outlined text-lg">{emp.isActive ? 'toggle_on' : 'toggle_off'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Bulk operations placeholder */}
      {!loading && employees.length > 0 && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="material-symbols-outlined text-lg">checklist</span>
            一括操作
          </div>
          <div className="relative group">
            <button className="px-3 py-1.5 bg-slate-200 text-slate-400 text-xs font-medium rounded-lg cursor-not-allowed" disabled>
              一括操作を実行
            </button>
            <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1 bg-slate-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              準備中
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{editing ? '従業員を編集' : '従業員を登録'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-400"><span className="text-red-500">*</span> は必須項目です</p>

            {/* Section: Basic Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <span className="material-symbols-outlined text-base text-[#7f19e6]">person</span>基本情報
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="氏名" value={form.name} onChange={(v) => { setForm({ ...form, name: v }); if (errors.name) setErrors({ ...errors, name: '' }) }} required error={errors.name} />
                <Field label="カナ" value={form.nameKana} onChange={(v) => setForm({ ...form, nameKana: v })} />
              </div>
              <Field label="メール" value={form.email} onChange={(v) => { setForm({ ...form, email: v }); if (errors.email) setErrors({ ...errors, email: '' }) }} type="email" required error={errors.email} />
            </div>

            {/* Section: Department & Role */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <span className="material-symbols-outlined text-base text-[#7f19e6]">badge</span>所属・権限
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="部署" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} options={[{ value: '', label: '未設定' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
                <SelectField label="権限" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              </div>
              <SelectField label="雇用形態" value={form.employmentType} onChange={(v) => setForm({ ...form, employmentType: v })} options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </div>

            {/* Section: Work Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                <span className="material-symbols-outlined text-base text-[#7f19e6]">schedule</span>勤務設定
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="就業ルール" value={form.workRuleId} onChange={(v) => setForm({ ...form, workRuleId: v })} options={[{ value: '', label: '未設定' }, ...workRules.map(r => ({ value: r.id, label: r.name }))]} />
                <Field label="入社日" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} type="date" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#7f19e6] text-white font-bold rounded-xl hover:bg-[#6a14c2] transition-colors disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, error }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${error ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : 'border-slate-300 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]'}`} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
