'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EmployeeGrid from '@/components/hr/EmployeeGrid'
import { Employee } from '@/components/hr/EmployeeCard'

interface Department {
  id: string
  name: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">従業員一覧</h1>
          <p className="text-sm text-slate-500 mt-1">組織のメンバーを管理</p>
        </div>
        <Link
          href="/hr/employees/new"
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-base font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          従業員を追加
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-50 mb-4">
            <span className="material-symbols-outlined text-4xl text-sky-500">group</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">まだ従業員が登録されていません</h3>
          <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
            従業員を追加して、タレントマネジメントを始めましょう。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/hr/employees/new"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-base font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              従業員を追加する
            </Link>
            <button
              disabled
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-base font-bold cursor-not-allowed opacity-60"
              title="準備中"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              CSVで一括登録
            </button>
          </div>
        </div>
      ) : (
        <EmployeeGrid employees={employees} departments={departments} />
      )}
    </div>
  )
}
