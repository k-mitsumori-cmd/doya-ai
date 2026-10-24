'use client'

import { AlertTriangle, CheckCircle2, Mail } from 'lucide-react'
import { PageTitle } from '@/components/kintai/ui-next'
import { useEffect, useId, useState, useMemo, useRef } from 'react'
import { Skeleton } from '@/components/ds'
import { alertDialog, confirmDialog } from '@/components/ds/dialog'
import { useEscapeToClose } from '@/lib/kintai/use-escape'
import { userErrorMessage, KINTAI_NETWORK_ERROR } from '@/lib/kintai/user-error'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, EMPLOYMENT_TYPE_LABELS } from '@/lib/kintai/types'
import { loadAllEmployees } from '@/lib/kintai/load-employees'
import { EmptyState } from '@/components/EmptyState'
import Link from 'next/link'

const DEPT_COLORS = [
  '#0066ff', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#0066ff', '#db2777', '#4f46e5', '#0d9488',
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
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | 'active' | 'inactive'>('')
  const [filterEmploymentType, setFilterEmploymentType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', nameKana: '', email: '', departmentId: '', workRuleId: '', employmentType: 'full_time', hireDate: '', role: 'employee' })
  const [saving, setSaving] = useState(false)
  const [limitNotice, setLimitNotice] = useState<{ message: string; href?: string; action?: string } | null>(null)
  const [inviteDeliveryFailure, setInviteDeliveryFailure] = useState<string | null>(null)
  const togglingRef = useRef(new Set<string>())
  const [togglingIds, setTogglingIds] = useState(new Set<string>())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentUserRole, setCurrentUserRole] = useState('employee')
  const loadSeq = useRef(0)
  const formTitleId = useId()
  useEscapeToClose(showForm, () => setShowForm(false), saving)

  const fetchAll = () => {
    const seq = ++loadSeq.current
    setLoading(true)
    setLoadError(false)
    setCurrentUserRole('employee')
    const readJson = async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error('従業員データを読み込めませんでした')
      return response.json()
    }
    Promise.all([
      loadAllEmployees((page, pageSize) => readJson(`/api/kintai/employees?page=${page}&pageSize=${pageSize}`)),
      readJson('/api/kintai/departments'),
      readJson('/api/kintai/work-rules'),
      readJson('/api/kintai/usage'),
    ]).then(([allEmployees, deptData, ruleData, usageData]) => {
      if (!Array.isArray(deptData.departments) || !Array.isArray(ruleData.rules)) {
        throw new Error('従業員データを読み込めませんでした')
      }
      if (loadSeq.current !== seq) return
      setEmployees(allEmployees)
      setDepartments(deptData.departments)
      setWorkRules(ruleData.rules)
      setCurrentUserRole(typeof usageData.role === 'string' ? usageData.role : 'employee')
    }).catch(() => {
      if (loadSeq.current === seq) setLoadError(true)
    }).finally(() => {
      if (loadSeq.current === seq) setLoading(false)
    })
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

  const showEmployeeLimit = (data: any) => {
    const canManageBilling = data.canManageBilling === true
    const upgradeAvailable = data.upgradeAvailable === true
    setLimitNotice({
      message: typeof data.error === 'string' ? data.error : '従業員数の上限に達しました。',
      href: canManageBilling ? upgradeAvailable ? '/kintai/pricing' : typeof data.contactUrl === 'string' && data.contactUrl.startsWith('https://') ? data.contactUrl : 'https://doyamarke.surisuta.jp/contact' : undefined,
      action: canManageBilling ? upgradeAvailable ? 'プランを確認する' : '追加の利用枠を相談する' : undefined,
    })
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const url = editing ? `/api/kintai/employees/${editing.id}` : '/api/kintai/employees'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        if (d.code === 'KINTAI_EMPLOYEE_LIMIT') { showEmployeeLimit(d); return }
        // 内部の詳細（d.detail）は画面に出さない
        await alertDialog({ title: '保存できませんでした', message: userErrorMessage(d.error, '入力を確かめて、もう一度お試しください。'), tone: 'error' })
        return
      }
      if (!editing) {
        const result = await res.json()
        setInviteDeliveryFailure(result.emailSent === true ? null : typeof result.inviteUrl === 'string' ? result.inviteUrl : null)
      }
      setLimitNotice(null)
      setShowForm(false)
      fetchAll()
    } catch { await alertDialog({ title: '保存できませんでした', message: KINTAI_NETWORK_ERROR, tone: 'error' }) } finally { setSaving(false) }
  }

  const toggleActive = async (emp: any) => {
    if (togglingRef.current.has(emp.id)) return
    const action = emp.isActive ? '無効化' : '有効化'
    // 確認ダイアログは待つ間に次の操作が入り得るので、確認の前に鍵をかけて二重送信を防ぐ
    togglingRef.current.add(emp.id)
    let confirmed = false
    try {
      confirmed = await confirmDialog({
        title: `${emp.name}さんを${action}しますか？`,
        message: emp.isActive ? '無効にすると、この人は打刻できなくなります。あとで有効に戻せます。' : '有効にすると、この人がまた打刻できるようになります。',
        confirmLabel: emp.isActive ? '無効にする' : '有効にする',
        tone: emp.isActive ? 'danger' : 'primary',
      })
    } finally {
      if (!confirmed) togglingRef.current.delete(emp.id)
    }
    if (!confirmed) return
    setTogglingIds(new Set(togglingRef.current))
    try {
      const res = await fetch(`/api/kintai/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !emp.isActive }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) {
        if (result?.code === 'KINTAI_EMPLOYEE_LIMIT') { showEmployeeLimit(result); return }
        await alertDialog({ title: `${action}できませんでした`, message: userErrorMessage(result?.error, '少し待って、もう一度お試しください。'), tone: 'error' })
        return
      }
      setLimitNotice(null)
      if (result?.employee?.id !== emp.id || typeof result.employee.isActive !== 'boolean') {
        await alertDialog({ title: '更新できたか確かめられませんでした', message: '画面を再読み込みして、状態を確かめてください。', tone: 'error' })
        return
      }
      setEmployees(previous => previous.map(row => row.id === emp.id ? { ...row, ...result.employee } : row))
    } catch {
      await alertDialog({ title: '更新できたか確かめられませんでした', message: '通信を確かめて、画面を再読み込みしてください。', tone: 'error' })
    } finally {
      togglingRef.current.delete(emp.id)
      setTogglingIds(new Set(togglingRef.current))
    }
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
    <>

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img src="/kintai/characters/point_%E8%A7%A3%E8%AA%AC.png" alt="くまさん" width={80} height={80} className="bear-float" />
            <div>
              <PageTitle className="text-xl font-bold text-slate-800">従業員管理</PageTitle>
              <p className="text-xs text-slate-500">チームメンバーを管理しよう</p>
            </div>
          </div>
          <button onClick={openCreate} disabled={loading || loadError} className="flex items-center gap-1.5 px-4 py-2 bg-[#0066ff] text-white text-sm font-bold rounded-lg hover:bg-[#0047d6] transition-colors shadow-sm shadow-[#0066ff]/20 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">person_add</span>新規登録
          </button>
        </div>

        {limitNotice && (
          <div role="alert" className="rounded-xl border border-brand-100 bg-brand-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-brand-800">{limitNotice.message}</p>
            {limitNotice.href && <Link href={limitNotice.href} className="rounded-lg bg-[#0066ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0047d6]">{limitNotice.action}</Link>}
          </div>
        )}
        {inviteDeliveryFailure && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">従業員を作成しましたが、招待メールを送信できませんでした。以下のURLをコピーして共有してください。</p>
            <div className="flex gap-2">
              <input aria-label="招待URL" value={inviteDeliveryFailure} readOnly className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" />
              <button type="button" onClick={async () => {
                try { await navigator.clipboard.writeText(inviteDeliveryFailure) }
                catch { await alertDialog({ title: 'コピーできませんでした', message: 'URL欄を選んで、手でコピーしてください。', tone: 'error' }) }
              }} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white">コピー</button>
            </div>
          </div>
        )}

        {/* Stats cards */}
        {!loading && !loadError && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 fade-in-up-1">
              <img src="/kintai/characters/hello_%E6%8C%A8%E6%8B%B6.png" alt="" width={40} height={40} className="bear-bounce" />
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
                <p className="text-xs text-slate-500">全従業員</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 fade-in-up-2">
              <img src="/kintai/characters/thumbsup_%E3%81%84%E3%81%84%E3%81%AD.png" alt="" width={40} height={40} className="bear-bounce" style={{ animationDelay: '0.3s' }} />
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.active}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
                <p className="text-xs text-green-600">有効</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 fade-in-up-3">
              <img src="/kintai/characters/sleep_%E5%B1%85%E7%9C%A0%E3%82%8A.png" alt="" width={40} height={40} className="bear-float" style={{ animationDelay: '0.6s' }} />
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
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-white">
            <option value="">全部署</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-white">
            <option value="">全状態</option>
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
          <select value={filterEmploymentType} onChange={e => setFilterEmploymentType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-white">
            <option value="">全雇用形態</option>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">絞り込み中:</span>
            {activeFilters.map(chip => (
              <span key={chip.key} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0066ff]/10 text-[#0066ff] text-xs font-medium rounded-full">
                {chip.label}
                <button onClick={() => clearFilter(chip.key)} className="hover:bg-[#0066ff]/20 rounded-full p-0.5">
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-slate-700 underline">すべてクリア</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5" aria-busy="true" aria-label="従業員を読み込み中">
            <Skeleton lines={6} height={18} />
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-bold text-red-800">従業員データを読み込めませんでした。時間をおいて再試行してください。</p>
            <button onClick={fetchAll} className="mt-4 rounded-lg border border-red-300 bg-white px-5 py-2 text-sm font-bold text-red-700 hover:bg-red-100">再試行</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center fade-in-up">
            {employees.length === 0 ? (
              <EmptyState
                kind="zero"
                title="最初のメンバーを追加しましょう"
                description="従業員を登録すると、打刻と勤怠の集計がはじまります。"
                action={
                  <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0057db]">
                    <span className="material-symbols-outlined text-lg">person_add</span>最初のメンバーを追加
                  </button>
                }
              />
            ) : (
              <EmptyState
                kind="no-results"
                title="条件に一致する従業員がいません"
                description="絞り込みを外すと、全員が表示されます。"
                action={
                  <button onClick={clearAllFilters} className="text-sm font-bold text-[#0066ff] hover:underline">フィルターをクリア</button>
                }
              />
            )}
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
                        <div className="flex flex-col items-center gap-1">
                          {emp.member?.status === 'PENDING' ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-yellow-100 text-yellow-700"><Mail size={14} strokeWidth={1.75} aria-hidden className="inline-block -mt-0.5 mr-1" />招待中</span>
                          ) : emp.member?.status === 'ACTIVE' ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700"><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden className="inline-block -mt-0.5 mr-1" />参加済</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">未参加</span>
                          )}
                          {!emp.isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400">無効</span>
                          )}
                          {emp.isActive && !emp.workRule && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700"><AlertTriangle size={14} strokeWidth={1.75} aria-hidden className="inline-block -mt-0.5 mr-1" />ルール未設定</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" aria-label={`${emp.name}さんを編集する`} onClick={() => openEdit(emp)} className="p-1.5 text-slate-400 hover:text-[#0066ff] hover:bg-brand-50 rounded-lg transition-colors" title="編集">
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          {emp.isActive && (emp.member?.status === 'PENDING' || emp.member?.status === 'INACTIVE') && <button
                            onClick={async () => {
                              if (!(await confirmDialog({ title: `${emp.name}さんに招待メールを送りますか？`, message: '参加用のリンクをメールで送ります。', confirmLabel: '送信する' }))) return
                              try {
                                const res = await fetch(`/api/kintai/employees/${emp.id}/invite`, { method: 'POST' })
                                const data = await res.json().catch(() => ({}))
                                if (data.inviteUrl) {
                                  let copied = false
                                  try { await navigator.clipboard.writeText(data.inviteUrl); copied = true } catch {}
                                  fetchAll()
                                  await alertDialog({
                                    title: data.emailSent ? '招待メールを送りました' : '招待メールを送れませんでした',
                                    tone: data.emailSent ? 'primary' : 'error',
                                    message: <>
                                      {copied ? '招待のリンクをコピーしました。' : 'リンクをコピーできませんでした。下のURLを手でコピーしてください。'}
                                      {'\n'}<span className="break-all">{data.inviteUrl}</span>
                                    </>,
                                  })
                                } else {
                                  await alertDialog({ title: '招待を作れませんでした', message: userErrorMessage(data.error, '少し待って、もう一度お試しください。'), tone: 'error' })
                                }
                              } catch { await alertDialog({ title: '招待を作れませんでした', message: KINTAI_NETWORK_ERROR, tone: 'error' }) }
                            }}
                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="招待メールを送信"
                            aria-label={`${emp.name}さんに招待メールを送る`}
                          >
                            <span className="material-symbols-outlined text-lg">mail</span>
                          </button>}
                          <button
                            onClick={() => toggleActive(emp)}
                            disabled={togglingIds.has(emp.id)}
                            aria-busy={togglingIds.has(emp.id)}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait ${emp.isActive ? 'text-green-500 hover:text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:text-green-500 hover:bg-green-50'}`}
                            title={emp.isActive ? '無効化する' : '有効化する'}
                            aria-label={`${emp.name}さんを${emp.isActive ? '無効にする' : '有効にする'}`}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby={formTitleId} className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg mx-4 space-y-5 max-h-[90vh] overflow-y-auto fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/kintai/characters/point_%E8%A7%A3%E8%AA%AC.png" alt="" width={48} height={48} className="bear-wiggle" />
                  <h2 id={formTitleId} className="text-lg font-bold text-slate-800">{editing ? '従業員を編集' : '従業員を登録'}</h2>
                </div>
                <button type="button" aria-label="閉じる" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p className="text-xs text-slate-400"><span className="text-red-500">*</span> は必須項目です</p>

              {/* Section: Basic Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="material-symbols-outlined text-base text-[#0066ff]">person</span>基本情報
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
                  <span className="material-symbols-outlined text-base text-[#0066ff]">badge</span>所属・権限
                </h3>
                <SelectField label="部署" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} options={[{ value: '', label: '未設定' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">権限 <span className="text-red-500">*</span></label>
                  <div className="space-y-2">
                    {(['system_admin', 'hr_admin', 'manager', 'employee'] as const).map(r => {
                      const isDisabled = r === 'system_admin' && currentUserRole !== 'system_admin'
                      return (
                        <label
                          key={r}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            form.role === r
                              ? 'border-[#0066ff] bg-[#0066ff]/5 ring-1 ring-[#0066ff]/30'
                              : isDisabled
                                ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={r}
                            checked={form.role === r}
                            disabled={isDisabled}
                            onChange={() => setForm({ ...form, role: r })}
                            className="mt-0.5 accent-[#0066ff]"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-800">{ROLE_LABELS[r]}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <SelectField label="雇用形態" value={form.employmentType} onChange={(v) => setForm({ ...form, employmentType: v })} options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              </div>

              {/* Section: Work Settings */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="material-symbols-outlined text-base text-[#0066ff]">schedule</span>勤務設定
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="就業ルール" value={form.workRuleId} onChange={(v) => setForm({ ...form, workRuleId: v })} options={[{ value: '', label: '未設定' }, ...workRules.map(r => ({ value: r.id, label: r.name }))]} />
                  <Field label="入社日" value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} type="date" />
                </div>
              </div>

              {limitNotice && (
                <div role="alert" className="rounded-xl border border-brand-100 bg-brand-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-brand-800">{limitNotice.message}</p>
                  {limitNotice.href && <Link href={limitNotice.href} className="inline-block text-sm font-bold text-[#0066ff] underline">{limitNotice.action}</Link>}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#0066ff] text-white font-bold rounded-xl hover:bg-[#0047d6] transition-colors disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Field({ label, value, onChange, type = 'text', required, error }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${error ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : 'border-slate-300 focus:ring-[#0066ff]/30 focus:border-[#0066ff]'}`} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-white">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
