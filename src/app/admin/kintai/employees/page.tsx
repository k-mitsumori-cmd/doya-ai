'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Employee {
  id: string
  name: string
  email: string
  organizationName: string | null
  role: string
  memberStatus: string
  departmentName: string | null
  createdAt: string
}

const PAGE_SIZE = 50

const ROLE_LABELS: Record<string, string> = { system_admin: 'システム管理者', hr_admin: '人事管理者', manager: '部門管理者', employee: '一般' }
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: '参加済', cls: 'bg-emerald-500/20 text-emerald-400' },
  PENDING: { label: '招待中', cls: 'bg-amber-500/20 text-amber-400' },
  INACTIVE: { label: '無効', cls: 'bg-white/5 text-white/30' },
}

export default function AdminKintaiEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const requestVersion = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchEmployees = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setLoadError(false)
    setEmployees([])
    setTotal(0)
    setTotalPages(0)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const response = await fetch(`/api/admin/kintai/employees?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      if (!Array.isArray(data?.employees) || !Number.isSafeInteger(data.total) || data.total < 0 ||
        data.page !== page || data.pageSize !== PAGE_SIZE || data.totalPages !== Math.ceil(data.total / PAGE_SIZE) ||
        data.employees.length !== Math.max(0, Math.min(PAGE_SIZE, data.total - (page - 1) * PAGE_SIZE))) {
        throw new Error('Invalid employees response')
      }
      if (version !== requestVersion.current) return
      if (page > Math.max(1, data.totalPages)) {
        setPage(Math.max(1, data.totalPages))
        return
      }
      setEmployees(data.employees)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      if (version === requestVersion.current) setLoadError(true)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    void fetchEmployees()
    return () => { requestVersion.current += 1 }
  }, [fetchEmployees, reloadKey])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">👥</span> 全従業員一覧
        </h1>
        {!loadError && <p className="text-sm text-white/40 mt-1">該当する従業員 {total}名</p>}
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          従業員情報を取得できませんでした。
          <button type="button" onClick={() => setReloadKey(key => key + 1)} className="ml-2 font-bold underline">再読み込み</button>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text" value={searchInput} maxLength={100} onChange={e => setSearchInput(e.target.value)}
            placeholder="名前・メール・組織名で検索..."
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 focus:outline-none focus:border-purple-500/50">
          <option value="">全ステータス</option>
          <option value="ACTIVE">参加済</option>
          <option value="PENDING">招待中</option>
          <option value="INACTIVE">無効</option>
        </select>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-white/40 font-medium">氏名</th>
                <th className="px-5 py-3 text-left text-white/40 font-medium">メール</th>
                <th className="px-5 py-3 text-left text-white/40 font-medium">組織</th>
                <th className="px-5 py-3 text-center text-white/40 font-medium">権限</th>
                <th className="px-5 py-3 text-center text-white/40 font-medium">ステータス</th>
                <th className="px-5 py-3 text-left text-white/40 font-medium">部署</th>
                <th className="px-5 py-3 text-left text-white/40 font-medium">登録日</th>
              </tr>
            </thead>
            <tbody>
              {loadError ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-white/30">取得できませんでした</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-white/30">該当なし</td></tr>
              ) : (
                employees.map(emp => {
                  const st = STATUS_LABELS[emp.memberStatus] || STATUS_LABELS.INACTIVE
                  return (
                    <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{emp.name}</td>
                      <td className="px-5 py-3 text-white/50 text-xs">{emp.email}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-lg">{emp.organizationName}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-xs text-white/50">{ROLE_LABELS[emp.role] || emp.role}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-3 text-white/40 text-xs">{emp.departmentName || '-'}</td>
                      <td className="px-5 py-3 text-white/30 text-xs">{new Date(emp.createdAt).toLocaleDateString('ja-JP')}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!loadError && totalPages > 1 && (
        <nav aria-label="従業員一覧のページ切り替え" className="flex items-center justify-center gap-3 text-sm text-white/60">
          <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40">前へ</button>
          <span>{page} / {totalPages} ページ</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40">次へ</button>
        </nav>
      )}
    </div>
  )
}
