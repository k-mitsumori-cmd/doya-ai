'use client'

import { useEffect, useState, useMemo } from 'react'

const ROLE_LABELS: Record<string, string> = { system_admin: 'システム管理者', hr_admin: '人事管理者', manager: '部門管理者', employee: '一般' }
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: '参加済', cls: 'bg-emerald-500/20 text-emerald-400' },
  PENDING: { label: '招待中', cls: 'bg-amber-500/20 text-amber-400' },
  INACTIVE: { label: '無効', cls: 'bg-white/5 text-white/30' },
}

export default function AdminKintaiEmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetch('/api/admin/kintai/employees')
      .then(r => r.json())
      .then(d => setEmployees(d.employees || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (search && !e.name.includes(search) && !e.email.includes(search) && !e.organizationName.includes(search)) return false
      if (statusFilter && e.memberStatus !== statusFilter) return false
      return true
    })
  }, [employees, search, statusFilter])

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
        <p className="text-sm text-white/40 mt-1">全組織の従業員 {employees.length}名</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="名前・メール・組織名で検索..."
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
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
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-white/30">該当なし</td></tr>
              ) : (
                filtered.map(emp => {
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
    </div>
  )
}
