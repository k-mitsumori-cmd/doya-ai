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
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            評価期間を作成
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-2xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {/* Periods List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-white rounded-3xl shadow-md animate-pulse" />
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
                    className="block bg-white rounded-3xl shadow-md p-6 hover:shadow-lg transition-all"
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
                      <span className="text-base font-black text-blue-600">{pct}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-slate-500">
                        {completed}/{total}件完了
                      </p>
                      <span className="material-symbols-outlined text-lg text-slate-400">chevron_right</span>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <motion.img
              src="/hr/characters/point_解説.png"
              alt="白くまキャラクター"
              className="w-40 mx-auto mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            />
            <h3 className="text-2xl font-black text-slate-900 mb-2">評価をはじめてみましょう！</h3>
            <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
              MBO（目標管理制度）に基づいた人事評価をオンラインでかんたんに管理できます。
            </p>
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="flex items-center gap-3 text-left max-w-sm w-full">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-black shrink-0">1</span>
                <span className="text-sm font-bold text-slate-700">評価期間を作成する</span>
              </div>
              <div className="flex items-center gap-3 text-left max-w-sm w-full">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500 text-xs font-black shrink-0">2</span>
                <span className="text-sm font-bold text-slate-700">対象者に評価シートを配布</span>
              </div>
              <div className="flex items-center gap-3 text-left max-w-sm w-full">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 text-xs font-black shrink-0">3</span>
                <span className="text-sm font-bold text-slate-700">自己評価 → 上司評価 → 最終評価</span>
              </div>
            </div>
            <motion.button
              onClick={() => setShowCreateModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              評価期間を作成
            </motion.button>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center hover:bg-blue-700 hover:shadow-2xl transition-all z-40"
          aria-label="評価期間を作成"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">評価期間を作成</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">期間名</label>
                  <input
                    type="text"
                    value={newPeriod.name}
                    onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="2026年度 上期評価"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">開始日</label>
                    <input
                      type="date"
                      value={newPeriod.startDate}
                      onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">終了日</label>
                    <input
                      type="date"
                      value={newPeriod.endDate}
                      onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreatePeriod}
                  disabled={creating || !newPeriod.name}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
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
