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
            <span className="text-red-500 ml-1">もう一度お試しください。</span>
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
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08 },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {periods.map((period) => {
              const total = period.totalEvaluations ?? period.evaluationCount ?? 0
              const completed = period.completedEvaluations ?? 0
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              const st = STATUS_MAP[period.status] ?? STATUS_MAP.DRAFT
              return (
                <motion.div
                  key={period.id}
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
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
                      {period.startDate && !isNaN(new Date(period.startDate).getTime())
                        ? new Date(period.startDate).toLocaleDateString('ja-JP')
                        : '未設定'}
                      {' 〜 '}
                      {period.endDate && !isNaN(new Date(period.endDate).getTime())
                        ? new Date(period.endDate).toLocaleDateString('ja-JP')
                        : '未設定'}
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
                        transition={{ duration: 1.2, ease: 'easeOut' }}
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
          </motion.div>
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
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="flex items-start gap-3 text-left max-w-md w-full bg-blue-50 rounded-2xl p-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-xs font-black shrink-0 mt-0.5">1</span>
                <div>
                  <span className="text-sm font-bold text-slate-900">評価期間を作成する</span>
                  <p className="text-xs text-slate-500 mt-0.5">上期（4-9月）や下期（10-3月）など、評価の対象期間を設定します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left max-w-md w-full bg-red-50 rounded-2xl p-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-500 text-xs font-black shrink-0 mt-0.5">2</span>
                <div>
                  <span className="text-sm font-bold text-slate-900">従業員に評価シートを割り当て</span>
                  <p className="text-xs text-slate-500 mt-0.5">対象の従業員を選んで、目標設定用の評価シートを配布します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left max-w-md w-full bg-emerald-50 rounded-2xl p-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 text-xs font-black shrink-0 mt-0.5">3</span>
                <div>
                  <span className="text-sm font-bold text-slate-900">自己評価 → 上司評価 → 最終評価</span>
                  <p className="text-xs text-slate-500 mt-0.5">3ステップで評価を進行。進捗はダッシュボードで確認できます</p>
                </div>
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
                {/* Presets */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">プリセットから選択</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const y = new Date().getFullYear()
                      return [
                        { label: `上期（${y}年4月〜9月）`, name: `${y}年度 上期評価`, start: `${y}-04-01`, end: `${y}-09-30` },
                        { label: `下期（${y}年10月〜${y+1}年3月）`, name: `${y}年度 下期評価`, start: `${y}-10-01`, end: `${y+1}-03-31` },
                        { label: '四半期（Q1）', name: `${y}年度 Q1評価`, start: `${y}-04-01`, end: `${y}-06-30` },
                      ]
                    })().map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setNewPeriod({ name: preset.name, startDate: preset.start, endDate: preset.end })}
                        className="px-3 py-1.5 text-xs font-bold rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
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
