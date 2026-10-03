'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
  activeCount: number
  pendingCount: number
  departments: { id: string; name: string }[]
  workRules: { id: string; name: string; workStart: string; workEnd: string }[]
}

interface Employee {
  id: string
  name: string
  email: string
  employmentType: string
  isActive: boolean
}

const ORGANIZATIONS_PAGE_SIZE = 20
const EMPLOYEES_PAGE_SIZE = 25

export default function AdminKintaiOrgsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeePage, setEmployeePage] = useState(1)
  const [employeeTotal, setEmployeeTotal] = useState(0)
  const [employeeTotalPages, setEmployeeTotalPages] = useState(0)
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState(false)
  const [employeeReloadKey, setEmployeeReloadKey] = useState(0)
  const listVersion = useRef(0)
  const employeeVersion = useRef(0)

  const fetchOrganizations = useCallback(async () => {
    const version = ++listVersion.current
    setLoading(true)
    setLoadError(false)
    setOrgs([])
    setTotal(0)
    setTotalPages(0)
    setExpandedOrg(null)
    try {
      const response = await fetch(`/api/admin/kintai/organizations?page=${page}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch organizations')
      const data = await response.json()
      if (!Array.isArray(data?.organizations) || !Number.isSafeInteger(data.total) || data.total < 0 ||
        data.page !== page || data.pageSize !== ORGANIZATIONS_PAGE_SIZE ||
        data.totalPages !== Math.ceil(data.total / ORGANIZATIONS_PAGE_SIZE) ||
        data.organizations.length !== Math.max(0, Math.min(ORGANIZATIONS_PAGE_SIZE, data.total - (page - 1) * ORGANIZATIONS_PAGE_SIZE))) {
        throw new Error('Invalid organizations response')
      }
      if (version !== listVersion.current) return
      if (page > Math.max(1, data.totalPages)) {
        setPage(Math.max(1, data.totalPages))
        return
      }
      setOrgs(data.organizations)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      if (version === listVersion.current) setLoadError(true)
    } finally {
      if (version === listVersion.current) setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void fetchOrganizations()
    return () => { listVersion.current += 1 }
  }, [fetchOrganizations, reloadKey])

  const fetchEmployees = useCallback(async () => {
    if (!expandedOrg) return
    const version = ++employeeVersion.current
    setEmployeeLoading(true)
    setEmployeeError(false)
    setEmployees([])
    setEmployeeTotal(0)
    setEmployeeTotalPages(0)
    try {
      const params = new URLSearchParams({ organizationId: expandedOrg, employeePage: String(employeePage) })
      const response = await fetch(`/api/admin/kintai/organizations?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      if (!Array.isArray(data?.employees) || !Number.isSafeInteger(data.total) || data.total < 0 ||
        data.page !== employeePage || data.pageSize !== EMPLOYEES_PAGE_SIZE ||
        data.totalPages !== Math.ceil(data.total / EMPLOYEES_PAGE_SIZE) ||
        data.employees.length !== Math.max(0, Math.min(EMPLOYEES_PAGE_SIZE, data.total - (employeePage - 1) * EMPLOYEES_PAGE_SIZE))) {
        throw new Error('Invalid employees response')
      }
      if (version !== employeeVersion.current) return
      if (employeePage > Math.max(1, data.totalPages)) {
        setEmployeePage(Math.max(1, data.totalPages))
        return
      }
      setEmployees(data.employees)
      setEmployeeTotal(data.total)
      setEmployeeTotalPages(data.totalPages)
    } catch {
      if (version === employeeVersion.current) setEmployeeError(true)
    } finally {
      if (version === employeeVersion.current) setEmployeeLoading(false)
    }
  }, [expandedOrg, employeePage])

  useEffect(() => {
    void fetchEmployees()
    return () => { employeeVersion.current += 1 }
  }, [fetchEmployees, employeeReloadKey])

  function toggleOrganization(id: string) {
    setEmployeePage(1)
    setExpandedOrg(current => current === id ? null : id)
  }

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
          <span className="text-3xl">🏢</span> 組織一覧
        </h1>
        {!loadError && <p className="text-sm text-white/40 mt-1">全{total}組織</p>}
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          組織情報を取得できませんでした。
          <button type="button" onClick={() => setReloadKey(key => key + 1)} className="ml-2 font-bold underline">再読み込み</button>
        </div>
      )}

      <div className="space-y-4">
        {orgs.map(org => (
          <div key={org.id} className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
            <button
              type="button"
              aria-expanded={expandedOrg === org.id}
              onClick={() => toggleOrganization(org.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                  {org.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-white font-bold">{org.name}</p>
                  <p className="text-xs text-white/30">{org.slug} / 作成: {new Date(org.createdAt).toLocaleDateString('ja-JP')}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-white font-bold">{org.activeCount}<span className="text-white/30 text-xs ml-0.5">名</span></p>
                  <p className="text-[10px] text-emerald-400">有効従業員</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold">{org.pendingCount}<span className="text-white/30 text-xs ml-0.5">名</span></p>
                  <p className="text-[10px] text-amber-400/60">招待中</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60">{org.departments.length}<span className="text-white/30 text-xs ml-0.5">部署</span></p>
                </div>
                <span className={`material-symbols-outlined text-white/30 transition-transform ${expandedOrg === org.id ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>
            </button>

            {expandedOrg === org.id && (
              <div className="border-t border-white/5 px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/40 mb-2 font-bold">部署</p>
                    <div className="flex flex-wrap gap-2">
                      {org.departments.map(d => (
                        <span key={d.id} className="px-2.5 py-1 bg-white/5 text-white/60 text-xs rounded-lg">{d.name}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-2 font-bold">就業ルール</p>
                    <div className="flex flex-wrap gap-2">
                      {org.workRules.map(rule => (
                        <span key={rule.id} className="px-2.5 py-1 bg-white/5 text-white/60 text-xs rounded-lg">{rule.name} ({rule.workStart}-{rule.workEnd})</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 mb-2 font-bold">従業員一覧 {!employeeLoading && !employeeError && `（全${employeeTotal}名）`}</p>
                  {employeeLoading ? <p className="text-sm text-white/40">読み込み中...</p> : employeeError ? (
                    <div role="alert" className="text-sm text-red-200">
                      従業員情報を取得できませんでした。
                      <button type="button" onClick={() => setEmployeeReloadKey(key => key + 1)} className="ml-2 font-bold underline">再読み込み</button>
                    </div>
                  ) : employeeTotal === 0 ? <p className="text-sm text-white/40">従業員は登録されていません。</p> : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/30 text-xs">
                            <th className="text-left py-1.5 px-2">氏名</th>
                            <th className="text-left py-1.5 px-2">メール</th>
                            <th className="text-center py-1.5 px-2">雇用</th>
                            <th className="text-center py-1.5 px-2">状態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employees.map(emp => (
                            <tr key={emp.id} className="border-t border-white/5">
                              <td className="py-2 px-2 text-white/80">{emp.name}</td>
                              <td className="py-2 px-2 text-white/40 text-xs">{emp.email}</td>
                              <td className="py-2 px-2 text-center text-white/40 text-xs">
                                {emp.employmentType === 'full_time' ? '正社員' : emp.employmentType === 'part_time' ? 'パート' : '契約'}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                                  {emp.isActive ? '有効' : '無効'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {employeeTotalPages > 1 && (
                        <nav aria-label={`${org.name}の従業員ページ`} className="flex items-center justify-center gap-3 text-sm text-white/60">
                          <button type="button" disabled={employeePage <= 1} onClick={() => setEmployeePage(current => current - 1)} className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40">前へ</button>
                          <span>{employeePage} / {employeeTotalPages} ページ</span>
                          <button type="button" disabled={employeePage >= employeeTotalPages} onClick={() => setEmployeePage(current => current + 1)} className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40">次へ</button>
                        </nav>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!loadError && totalPages > 1 && (
        <nav aria-label="組織一覧のページ切り替え" className="flex items-center justify-center gap-3 text-sm text-white/60">
          <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40">前へ</button>
          <span>{page} / {totalPages} ページ</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40">次へ</button>
        </nav>
      )}
    </div>
  )
}
