'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface EvaluationPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  evaluationCount: number
  totalEvaluations?: number
  completedEvaluations?: number
}

export default function EvaluationsPage() {
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ name: '', startDate: '', endDate: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchPeriods()
  }, [])

  async function fetchPeriods() {
    try {
      const res = await fetch('/api/hr/evaluations/periods')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPeriods(data.items ?? data.periods ?? [])
    } catch {
      // API not ready
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePeriod() {
    if (!newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) return
    setCreating(true)
    try {
      const res = await fetch('/api/hr/evaluations/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPeriod),
      })
      if (!res.ok) throw new Error('評価期間の作成に失敗しました')
      setShowCreateModal(false)
      setNewPeriod({ name: '', startDate: '', endDate: '' })
      fetchPeriods()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    DRAFT: { label: '準備中', color: 'bg-slate-100 text-slate-600' },
    OPEN: { label: '進行中', color: 'bg-emerald-100 text-emerald-700' },
    IN_REVIEW: { label: 'レビュー中', color: 'bg-amber-100 text-amber-700' },
    CLOSED: { label: '終了', color: 'bg-blue-100 text-blue-700' },
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">評価管理</h1>
            <p className="text-sm text-slate-500 mt-1">MBO評価の期間を管理</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-base font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            評価期間を作成
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {/* Periods List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : periods.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {periods.map((period, i) => {
              const total = period.totalEvaluations ?? period.evaluationCount ?? 0
              const completed = period.completedEvaluations ?? 0
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              const st = STATUS_MAP[period.status] ?? STATUS_MAP.DRAFT
              return (
                <motion.div
                  key={period.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/hr/evaluations/${period.id}`}
                    className="block bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-sky-200 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-900">{period.name}</h3>
                      <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      {new Date(period.startDate).toLocaleDateString('ja-JP')} 〜 {new Date(period.endDate).toLocaleDateString('ja-JP')}
                    </p>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">進捗</span>
                      <span className="text-base font-black text-sky-600">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {completed}/{total}件完了
                    </p>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <span className="material-symbols-outlined text-5xl mb-3 block">assessment</span>
            <p className="text-lg font-bold">評価期間がまだありません</p>
            <p className="text-sm mt-1">「評価期間を作成」ボタンから始めましょう</p>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">評価期間を作成</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">期間名</label>
                  <input
                    type="text"
                    value={newPeriod.name}
                    onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                    placeholder="2026年度 上期評価"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">開始日</label>
                    <input
                      type="date"
                      value={newPeriod.startDate}
                      onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">終了日</label>
                    <input
                      type="date"
                      value={newPeriod.endDate}
                      onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreatePeriod}
                  disabled={creating || !newPeriod.name}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
