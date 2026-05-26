'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import EmployeeCard, { Employee } from './EmployeeCard'
import Link from 'next/link'

interface Department {
  id: string
  name: string
}

interface EmployeeGridProps {
  employees: Employee[]
  departments: Department[]
}

export default function EmployeeGrid({ employees, departments }: EmployeeGridProps) {
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        !search ||
        `${emp.lastName}${emp.firstName}${emp.lastNameKana || ''}${emp.firstNameKana || ''}${emp.employeeNumber || ''}${emp.email || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchDept =
        departmentFilter === 'all' || emp.departmentId === departmentFilter

      const matchStatus =
        statusFilter === 'all' || emp.status === statusFilter

      return matchSearch && matchDept && matchStatus
    })
  }, [employees, search, departmentFilter, statusFilter])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前、社員番号、メールで検索..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all"
          />
        </div>

        {/* Department Filter */}
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
        >
          <option value="all">全部署</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
        >
          <option value="all">全ステータス</option>
          <option value="ACTIVE">在籍</option>
          <option value="ON_LEAVE">休職中</option>
          <option value="RESIGNED">退職</option>
        </select>

        {/* View Toggle */}
        <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2.5 transition-colors ${
              viewMode === 'grid' ? 'bg-sky-50 text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-xl">grid_view</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2.5 transition-colors ${
              viewMode === 'list' ? 'bg-sky-50 text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-xl">view_list</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-slate-500 mb-4">
        {filtered.length}名の従業員
      </p>

      {/* Grid / List */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filtered.map((emp) => (
              <EmployeeCard key={emp.id} employee={emp} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">従業員</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">部署</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">役職</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const initials = `${emp.lastName?.[0] || ''}${emp.firstName?.[0] || ''}`
                  const statusMap: Record<string, { label: string; color: string }> = {
                    ACTIVE: { label: '在籍', color: 'bg-emerald-100 text-emerald-700' },
                    ON_LEAVE: { label: '休職中', color: 'bg-amber-100 text-amber-700' },
                    RESIGNED: { label: '退職', color: 'bg-slate-100 text-slate-500' },
                  }
                  const st = statusMap[emp.status] ?? statusMap.ACTIVE
                  return (
                    <Link
                      key={emp.id}
                      href={`/hr/employees/${emp.id}`}
                      className="contents"
                    >
                      <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {emp.photoUrl ? (
                              <img src={emp.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                {initials}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {emp.lastName} {emp.firstName}
                              </p>
                              {emp.employeeNumber && (
                                <p className="text-xs text-slate-400">{emp.employeeNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                          {emp.department?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                          {emp.position || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    </Link>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 block">person_off</span>
                <p>該当する従業員が見つかりません</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 && viewMode === 'grid' && (
        <div className="text-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">person_off</span>
          <p className="text-lg font-medium">該当する従業員が見つかりません</p>
          <p className="text-sm mt-1">検索条件を変更してみてください</p>
        </div>
      )}
    </div>
  )
}
