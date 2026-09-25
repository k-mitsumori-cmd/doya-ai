'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import toast from 'react-hot-toast'
import EmployeeGrid from '@/components/hr/EmployeeGrid'
import { Employee } from '@/components/hr/EmployeeCard'
import CsvImportModal from '@/components/hr/CsvImportModal'

interface Department {
  id: string
  name: string
}

type SortKey = 'name' | 'hireDate' | 'department'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [showImport, setShowImport] = useState(false)
  const [canManageEmployees, setCanManageEmployees] = useState(false)
  const [hasLinkedEmployee, setHasLinkedEmployee] = useState<boolean | null>(null)

  async function fetchData() {
    try {
      const [empRes, deptRes, usageRes] = await Promise.all([
        fetch('/api/hr/employees'),
        fetch('/api/hr/departments'),
        fetch('/api/hr/usage'),
      ])
      if (usageRes.ok) {
        const usage = await usageRes.json()
        setCanManageEmployees(usage.canManageEmployees === true)
        setHasLinkedEmployee(usage.hasLinkedEmployee === true)
      }
      if (empRes.ok) {
        const empData = await empRes.json()
        setEmployees(empData.items ?? empData.employees ?? [])
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json()
        setDepartments(deptData.flat ?? deptData.departments ?? [])
      }
    } catch (e: any) {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
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
          <p className="text-sm text-slate-500 mt-1">{canManageEmployees ? '組織のメンバーを管理' : 'あなたの従業員情報を確認'}</p>
        </div>
        {canManageEmployees && <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-full text-base font-bold shadow-sm hover:shadow-md hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            CSV一括登録
          </button>
          <Link
            href="/hr/employees/new"
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            従業員を追加
          </Link>
        </div>}
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
            src="/hr/characters/hello_%E6%8C%A8%E6%8B%B6.png"
            alt="白くまキャラクター"
            className="w-40 mx-auto mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
          <h3 className="text-xl font-black text-slate-900 mb-2">
            {canManageEmployees ? 'チームのメンバーを登録しましょう！' : '従業員情報を表示できません'}
          </h3>
          <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
            {canManageEmployees
              ? '従業員を追加して、タレントマネジメントを始めましょう。'
              : hasLinkedEmployee === false
                ? 'アカウントに従業員情報が紐付いていません。組織の管理者に確認してください。'
                : '従業員情報が見つかりません。組織の管理者に確認してください。'}
          </p>
          {canManageEmployees ? <div className="flex flex-col items-center gap-4">
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
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-all"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              CSVで一括登録
            </button>
          </div> : null}
        </motion.div>
      ) : (
        <EmployeeGrid employees={sortedEmployees} departments={departments} />
      )}

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          setLoading(true)
          fetchData()
        }}
      />
    </div>
  )
}
