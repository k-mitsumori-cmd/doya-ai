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

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-red-400 to-red-500',
  'from-emerald-500 to-emerald-600',
  'from-amber-400 to-amber-500',
  'from-purple-500 to-purple-600',
  'from-pink-400 to-pink-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
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
            <h1 className="text-3xl font-black text-slate-900">1on1</h1>
            <p className="text-sm text-slate-500 mt-1">1対1ミーティングの記録を管理</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full text-base font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:bg-emerald-700 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            1on1を記録
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-2xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {/* Records List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-white rounded-3xl shadow-md animate-pulse" />
            ))}
          </div>
        ) : records.length > 0 ? (
          <div className="space-y-3">
            {records.map((record, i) => {
              const initials = record.employeeName
                ? `${record.employeeName[0]}${record.employeeName.length > 1 ? record.employeeName[1] : ''}`
                : '??'
              const avatarColor = getAvatarColor(record.employeeName || record.employeeId)
              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/hr/one-on-one/${record.id}`}
                    className="flex items-center gap-4 bg-white rounded-3xl shadow-md p-5 hover:shadow-lg transition-all"
                  >
                    {record.employeePhotoUrl ? (
                      <img src={record.employeePhotoUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900">{record.employeeName}</p>
                      <p className="text-xs text-slate-500">
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
                      <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
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
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <motion.img
              src="/hr/characters/present_プレゼン.png"
              alt="白くまキャラクター"
              className="w-40 mx-auto mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            />
            <h3 className="text-2xl font-black text-slate-900 mb-2">1on1をはじめましょう！</h3>
            <p className="text-base text-slate-500 mb-2 max-w-md mx-auto">
              定期的な1on1で、メンバーの成長をサポートしましょう。
            </p>
            <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
              AIが会話の要約とアクションアイテムを自動生成します。
            </p>
            <motion.button
              onClick={() => setShowNewModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white rounded-full text-base font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:bg-emerald-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              1on1を記録する
            </motion.button>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setShowNewModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-700 hover:shadow-2xl transition-all z-50"
          title="1on1を記録"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>

        {/* New 1on1 Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowNewModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">1on1を記録</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">対象の従業員（部下）</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateRecord}
                  disabled={creating || !selectedEmployee || !selectedManager}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
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
