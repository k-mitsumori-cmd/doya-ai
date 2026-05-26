'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface OneOnOneRecord {
  id: string
  employeeId: string
  employeeName: string
  employeePhotoUrl?: string | null
  date: string
  duration: number
  status: string
  agendaCount: number
  actionItemCount: number
}

export default function OneOnOnePage() {
  const router = useRouter()
  const [records, setRecords] = useState<OneOnOneRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchRecords()
    fetchEmployees()
  }, [])

  async function fetchRecords() {
    try {
      const res = await fetch('/api/hr/one-on-one')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const items = (data.items ?? data.records ?? []).map((o: any) => ({
        id: o.id,
        employeeId: o.employeeId,
        employeeName: o.employee ? `${o.employee.lastName} ${o.employee.firstName}` : '',
        employeePhotoUrl: o.employee?.photoUrl || null,
        date: o.conductedAt || o.scheduledAt || o.createdAt,
        duration: o.duration || 0,
        status: o.status,
        agendaCount: Array.isArray(o.agenda) ? o.agenda.length : 0,
        actionItemCount: Array.isArray(o.aiActionItems) ? o.aiActionItems.length : 0,
      }))
      setRecords(items)
    } catch {
      // API not ready
    } finally {
      setLoading(false)
    }
  }

  async function fetchEmployees() {
    try {
      const res = await fetch('/api/hr/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.items ?? data.employees ?? [])
      }
    } catch {}
  }

  async function handleCreateRecord() {
    if (!selectedEmployee || !selectedManager) return
    setCreating(true)
    try {
      const res = await fetch('/api/hr/one-on-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          managerId: selectedManager,
          scheduledAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('1on1の作成に失敗しました')
      const data = await res.json()
      const newId = data.oneOnOne?.id ?? data.id
      if (newId) {
        router.push(`/hr/one-on-one/${newId}`)
      } else {
        setShowNewModal(false)
        fetchRecords()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900">1on1</h1>
            <p className="text-sm text-slate-500 mt-1">1対1ミーティングの記録を管理</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            1on1を記録
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {/* Records List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : records.length > 0 ? (
          <div className="space-y-3">
            {records.map((record, i) => {
              const initials = record.employeeName
                ? `${record.employeeName[0]}${record.employeeName.length > 1 ? record.employeeName[1] : ''}`
                : '??'
              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/hr/one-on-one/${record.id}`}
                    className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-sky-200 transition-all"
                  >
                    {record.employeePhotoUrl ? (
                      <img src={record.employeePhotoUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{record.employeeName}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(record.date).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' '}/ {record.duration}分
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">list_alt</span>
                          {record.agendaCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">task_alt</span>
                          {record.actionItemCount}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        record.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {record.status === 'COMPLETED' ? '完了' : '予定'}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 block">forum</span>
            <p className="text-lg font-medium">1on1の記録がまだありません</p>
            <p className="text-sm mt-1">「1on1を記録」ボタンから始めましょう</p>
          </div>
        )}

        {/* New 1on1 Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowNewModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">1on1を記録</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">対象の従業員（部下）</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  >
                    <option value="">選択してください</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.lastName} {emp.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">上司（面談者）</label>
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  >
                    <option value="">選択してください</option>
                    {employees.filter((e: any) => e.id !== selectedEmployee).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.lastName} {emp.firstName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateRecord}
                  disabled={creating || !selectedEmployee || !selectedManager}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50"
                >
                  {creating ? '作成中...' : '開始'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
