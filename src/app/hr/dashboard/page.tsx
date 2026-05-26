'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface DashboardStats {
  employeeCount: number
  departmentCount: number
  activeEvaluations: number
  monthlyOneOnOnes: number
  orgName: string
}

interface RecentOneOnOne {
  id: string
  employeeName: string
  date: string
  status: string
}

interface EvaluationPeriod {
  id: string
  name: string
  progress: number
  total: number
  completed: number
}

const STAT_CARDS = [
  { key: 'employeeCount', icon: 'people', label: '従業員数', color: 'from-sky-400 to-blue-500' },
  { key: 'departmentCount', icon: 'apartment', label: '部署数', color: 'from-blue-400 to-indigo-500' },
  { key: 'activeEvaluations', icon: 'assessment', label: '進行中の評価', color: 'from-indigo-400 to-purple-500' },
  { key: 'monthlyOneOnOnes', icon: 'forum', label: '今月の1on1', color: 'from-purple-400 to-pink-500' },
]

export default function HrDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    employeeCount: 0,
    departmentCount: 0,
    activeEvaluations: 0,
    monthlyOneOnOnes: 0,
    orgName: '',
  })
  const [recentOneOnOnes, setRecentOneOnOnes] = useState<RecentOneOnOne[]>([])
  const [evaluationPeriods, setEvaluationPeriods] = useState<EvaluationPeriod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/hr/dashboard')
        if (!res.ok) throw new Error()
        const data = await res.json()
        setStats({
          employeeCount: data.employeeCount ?? 0,
          departmentCount: data.departmentCount ?? 0,
          activeEvaluations: data.activeEvaluations ?? 0,
          monthlyOneOnOnes: data.monthlyOneOnOnes ?? 0,
          orgName: data.orgName ?? '',
        })
        setRecentOneOnOnes(data.recentOneOnOnes ?? [])
        setEvaluationPeriods(data.evaluationPeriods ?? [])
      } catch {
        // API not ready yet — show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">
          {stats.orgName ? `${stats.orgName} のダッシュボード` : 'ダッシュボード'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">組織の概況をひと目で確認</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl border border-slate-200 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-sm`}>
                <span className="material-symbols-outlined text-xl">{card.icon}</span>
              </div>
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-4xl font-black text-slate-900">
              {loading ? (
                <span className="inline-block w-12 h-8 bg-slate-100 rounded animate-pulse" />
              ) : (
                (stats as any)[card.key]
              )}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent 1on1 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500">forum</span>
              最近の1on1
            </h2>
            <Link href="/hr/one-on-one" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
              すべて見る
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentOneOnOnes.length > 0 ? (
            <div className="space-y-2">
              {recentOneOnOnes.map((item) => (
                <Link
                  key={item.id}
                  href={`/hr/one-on-one/${item.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-base font-bold text-slate-900">{item.employeeName}</p>
                    <p className="text-sm text-slate-500">{new Date(item.date).toLocaleDateString('ja-JP')}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                    item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.status === 'COMPLETED' ? '完了' : '予定'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-3xl mb-2 block">forum</span>
              <p className="text-lg font-bold">まだ1on1の記録がありません</p>
              <Link
                href="/hr/one-on-one"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-sky-600 hover:text-sky-700"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                1on1を記録する
              </Link>
            </div>
          )}
        </div>

        {/* Evaluation Periods */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500">assessment</span>
              評価期間の進捗
            </h2>
            <Link href="/hr/evaluations" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
              すべて見る
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : evaluationPeriods.length > 0 ? (
            <div className="space-y-4">
              {evaluationPeriods.map((period) => {
                const pct = period.total > 0 ? Math.round((period.completed / period.total) * 100) : 0
                return (
                  <Link key={period.id} href={`/hr/evaluations/${period.id}`} className="block">
                    <div className="p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-base font-bold text-slate-900">{period.name}</p>
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
                      <p className="text-xs text-slate-500 mt-1">{period.completed}/{period.total}件完了</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-3xl mb-2 block">assessment</span>
              <p className="text-lg font-bold">評価期間が設定されていません</p>
              <Link
                href="/hr/evaluations"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-sky-600 hover:text-sky-700"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                評価期間を作成
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-black text-slate-900 mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: '/hr/employees/new', icon: 'person_add', label: '従業員を追加' },
            { href: '/hr/one-on-one', icon: 'forum', label: '1on1を記録' },
            { href: '/hr/evaluations', icon: 'assessment', label: '評価を開始' },
            { href: '/hr/org-chart', icon: 'account_tree', label: '組織図を確認' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all"
            >
              <span className="material-symbols-outlined text-sky-500">{action.icon}</span>
              <span className="text-base font-bold text-slate-700">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
