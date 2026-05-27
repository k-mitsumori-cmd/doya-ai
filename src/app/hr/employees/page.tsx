'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import EmployeeGrid from '@/components/hr/EmployeeGrid'
import { Employee } from '@/components/hr/EmployeeCard'

interface Department {
  id: string
  name: string
}

type SortKey = 'name' | 'hireDate' | 'department'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')

  useEffect(() => {
    async function fetchData() {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch('/api/hr/employees'),
          fetch('/api/hr/departments'),
        ])
        if (empRes.ok) {
          const empData = await empRes.json()
          setEmployees(empData.items ?? empData.employees ?? [])
        }
        if (deptRes.ok) {
          const deptData = await deptRes.json()
          setDepartments(deptData.flat ?? deptData.departments ?? [])
        }
      } catch (e: any) {
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const sortedEmployees = [...employees].sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return `${a.lastName ?? ''}${a.firstName ?? ''}`.localeCompare(`${b.lastName ?? ''}${b.firstName ?? ''}`, 'ja')
      case 'hireDate':
        return ((b as any).hireDate ?? '').localeCompare((a as any).hireDate ?? '')
      case 'department':
        return ((a as any).department?.name ?? '').localeCompare((b as any).department?.name ?? '', 'ja')
      default:
        return 0
    }
  })

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            従業員一覧
            {!loading && employees.length > 0 && (
              <span className="ml-3 text-lg font-bold text-slate-400">全 {employees.length} 名</span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">組織のメンバーを管理</p>
        </div>
        <Link
          href="/hr/employees/new"
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          従業員を追加
        </Link>
      </div>

      {/* Sort Controls */}
      {!loading && employees.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">sort</span>
            並び替え:
          </span>
          {[
            { key: 'name' as SortKey, label: '名前順' },
            { key: 'hireDate' as SortKey, label: '入社日順' },
            { key: 'department' as SortKey, label: '部署別' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                sortKey === opt.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
          {error}
          <span className="text-red-500 ml-1">もう一度お試しください。</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-3xl shadow-md p-6 animate-pulse">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 mb-4" />
                <div className="w-24 h-4 bg-slate-100 rounded mb-2" />
                <div className="w-16 h-3 bg-slate-100 rounded mb-2" />
                <div className="w-12 h-5 bg-slate-100 rounded-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-md p-12 text-center"
        >
          <motion.img
            src="/hr/characters/hello_挨拶.png"
            alt="白くまキャラクター"
            className="w-40 mx-auto mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
          <h3 className="text-xl font-black text-slate-900 mb-2">チームのメンバーを登録しましょう！</h3>
          <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
            従業員を追加して、タレントマネジメントを始めましょう。
          </p>
          <div className="flex flex-col items-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/hr/employees/new"
                className="flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl text-lg font-black hover:shadow-xl hover:shadow-sky-500/30 transition-all shadow-lg shadow-sky-500/20"
              >
                <span className="material-symbols-outlined text-2xl">person_add</span>
                最初の従業員を追加する
              </Link>
            </motion.div>
            <button
              disabled
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-sm font-bold cursor-not-allowed opacity-60"
              title="準備中"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              CSVで一括登録（準備中）
            </button>
          </div>
        </motion.div>
      ) : (
        <EmployeeGrid employees={sortedEmployees} departments={departments} />
      )}
    </div>
  )
}
