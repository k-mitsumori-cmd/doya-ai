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

const AVATAR_COLORS = [
  'from-blue-400 to-blue-600',
  'from-red-400 to-red-600',
  'from-green-400 to-green-600',
  'from-amber-400 to-amber-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
]

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
        {/* Search - Google style */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-2xl">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前、社員番号、メールで検索..."
            className="w-full pl-12 pr-4 py-3 bg-white rounded-full shadow-sm hover:shadow-md text-base focus:outline-none focus:shadow-md focus:ring-1 focus:ring-blue-200 transition-all"
          />
        </div>

        {/* Department Filter - chip style */}
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-base font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer border-none"
        >
          <option value="all">全部署</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Status Filter - chip style */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-base font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all cursor-pointer border-none"
        >
          <option value="all">全ステータス</option>
          <option value="ACTIVE">在籍</option>
          <option value="ON_LEAVE">休職中</option>
          <option value="RESIGNED">退職</option>
        </select>

        {/* View Toggle - rounded-full */}
        <div className="flex bg-gray-100 rounded-full overflow-hidden p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-full transition-all ${
              viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">grid_view</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-full transition-all ${
              viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">view_list</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-base font-bold text-gray-600 mb-4">
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
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
            className="bg-white rounded-2xl shadow-md overflow-hidden"
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">従業員</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">部署</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">役職</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const initials = `${emp.lastName?.[0] || ''}${emp.firstName?.[0] || ''}`
                  const colorIndex = ((emp.lastName?.charCodeAt(0) || 0) + (emp.firstName?.charCodeAt(0) || 0)) % AVATAR_COLORS.length
                  const statusMap: Record<string, { label: string; color: string }> = {
                    ACTIVE: { label: '在籍', color: 'bg-emerald-100 text-emerald-700' },
                    ON_LEAVE: { label: '休職中', color: 'bg-amber-100 text-amber-700' },
                    RESIGNED: { label: '退職', color: 'bg-gray-100 text-gray-500' },
                  }
                  const st = statusMap[emp.status] ?? statusMap.ACTIVE
                  return (
                    <Link
                      key={emp.id}
                      href={`/hr/employees/${emp.id}`}
                      className="contents"
                    >
                      <tr className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {emp.photoUrl ? (
                              <img src={emp.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIndex]} flex items-center justify-center text-white text-sm font-bold`}>
                                {initials}
                              </div>
                            )}
                            <div>
                              <p className="text-base font-bold text-gray-900">
                                {emp.lastName} {emp.firstName}
                              </p>
                              {emp.employeeNumber && (
                                <p className="text-xs font-semibold text-gray-500">{emp.employeeNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-base font-semibold text-gray-700 hidden sm:table-cell">
                          {emp.department?.name || '-'}
                        </td>
                        <td className="px-4 py-4 text-base text-gray-600 hidden md:table-cell">
                          {emp.position || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${st.color}`}>
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
              <div className="p-12 text-center text-gray-400">
                <span className="material-symbols-outlined text-6xl mb-3 block text-gray-300">person_search</span>
                <p className="text-lg font-bold text-gray-600">該当する従業員が見つかりません</p>
                <p className="text-base font-semibold text-gray-400 mt-1">検索条件を変えてみましょう!</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 && viewMode === 'grid' && (
        <div className="text-center py-20 text-gray-400">
          <span className="material-symbols-outlined text-7xl mb-4 block text-gray-300">person_search</span>
          <p className="text-xl font-bold text-gray-600">該当する従業員が見つかりません</p>
          <p className="text-base font-semibold text-gray-400 mt-2">検索条件を変えてみましょう!</p>
        </div>
      )}
    </div>
  )
}
