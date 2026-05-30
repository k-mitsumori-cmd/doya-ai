'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

/** Hook: 0 から target まで段階的にカウントアップする */
function useCountUp(target: number, loading: boolean) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (loading || target === 0) { setDisplay(target); return }
    let current = 0
    const step = Math.max(1, Math.ceil(target / 20))
    const interval = setInterval(() => {
      current += step
      if (current >= target) { setDisplay(target); clearInterval(interval) }
      else setDisplay(current)
    }, 50)
    return () => clearInterval(interval)
  }, [target, loading])
  return display
}

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
  { key: 'employeeCount', icon: 'people', label: '従業員数', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'departmentCount', icon: 'apartment', label: '部署数', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { key: 'activeEvaluations', icon: 'assessment', label: '進行中の評価', iconBg: 'bg-red-100', iconColor: 'text-red-500' },
]

const SETUP_STEPS = [
  {
    step: 1,
    title: '部署を作成する',
    desc: 'まず組織の部署構成を登録しましょう',
    time: '約1分',
    href: '/hr/settings',
    icon: 'apartment',
    doneKey: 'departmentCount',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    step: 2,
    title: '従業員を登録する',
    desc: 'メンバーの情報を登録します',
    time: '1人あたり約2分',
    href: '/hr/employees/new',
    icon: 'person_add',
    doneKey: 'employeeCount',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    step: 3,
    title: '評価期間を設定する',
    desc: 'MBO評価の期間を設定しましょう',
    time: '約3分',
    href: '/hr/evaluations',
    icon: 'assessment',
    doneKey: 'activeEvaluations',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
  },
]

const QUICK_ACTIONS = [
  { href: '/hr/employees/new', icon: 'person_add', label: '従業員を追加', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { href: '/hr/evaluations', icon: 'assessment', label: '評価を開始', iconBg: 'bg-red-100', iconColor: 'text-red-500' },
  { href: '/hr/org-chart', icon: 'account_tree', label: '組織図を確認', iconBg: 'bg-amber-100', iconColor: 'text-amber-500' },
]

function StatValue({ statKey, stats, loading }: { statKey: string; stats: DashboardStats; loading: boolean }) {
  const target = (stats as any)[statKey] as number
  const display = useCountUp(target, loading)
  if (loading) return <span className="inline-block w-12 h-8 bg-slate-100 rounded animate-pulse" />
  return <>{display}</>
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 11) return 'おはようございます！'
  if (hour >= 12 && hour <= 17) return 'お疲れさまです！'
  if (hour >= 18 && hour <= 23) return '今日もお疲れさまでした！'
  return '夜遅くまでお疲れさまです！'
}

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
      <div className="mb-8 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-base font-bold text-blue-600 mb-1">{getGreeting()}</p>
          <h1 className="text-3xl font-black text-slate-900">
            {stats.orgName ? `${stats.orgName} のダッシュボード` : 'ダッシュボード'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">組織の概況をひと目で確認</p>
        </div>
        <motion.img
          src="/hr/characters/thumbsup_いいね.png"
          alt="白くまキャラクター"
          className="w-16 drop-shadow-md"
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        />
      </div>

      {/* Stats Cards */}
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
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
      >
        {STAT_CARDS.map((card) => (
          <motion.div
            key={card.key}
            variants={{
              hidden: { opacity: 0, y: 20, scale: 0.95 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            whileHover={{ scale: 1.05, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white rounded-3xl shadow-md p-5 cursor-default"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-2xl ${card.iconBg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-xl ${card.iconColor}`}>{card.icon}</span>
              </div>
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-4xl font-black text-slate-900">
              <StatValue statKey={card.key} stats={stats} loading={loading} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Setup Guide — shown when no employees */}
      {!loading && stats.employeeCount === 0 && (
        <>
        {/* What ドヤHR can do */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl shadow-md p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-xl text-blue-600">info</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">ドヤHR でできること</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: 'people', color: 'text-blue-600', bg: 'bg-blue-100', title: '従業員管理', desc: '社員の基本情報・部署・役職を一元管理' },
              { icon: 'assessment', color: 'text-red-500', bg: 'bg-red-100', title: 'MBO評価', desc: '目標管理に基づく人事評価をオンラインで実施' },
              { icon: 'account_tree', color: 'text-amber-500', bg: 'bg-amber-100', title: '組織図', desc: '部署構成をビジュアルに表示・管理' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-2`}>
                  <span className={`material-symbols-outlined text-lg ${item.color}`}>{item.icon}</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 bg-white rounded-3xl shadow-md p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl text-blue-600">rocket_launch</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">はじめてのセットアップ</h2>
          </div>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 items-start"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.2 },
              },
            }}
          >
            {/* Setup Guide Character */}
            <motion.img
              src="/hr/characters/point_解説.png"
              alt="白くまキャラクター"
              className="hidden sm:block w-40 flex-shrink-0 drop-shadow-lg"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            />
            {SETUP_STEPS.map((item) => {
              const done = (stats as any)[item.doneKey] > 0
              return (
                <motion.div
                  key={item.step}
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  className="flex-1"
                >
                <Link
                  href={item.href}
                  className={`relative block rounded-3xl p-4 transition-all hover:shadow-md ${
                    done ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-blue-50'
                  }`}
                >
                  {done && (
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-white text-sm">check</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                      done ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 shadow-sm'
                    }`}>
                      {item.step}
                    </span>
                    <div className={`w-8 h-8 rounded-xl ${done ? 'bg-emerald-100' : item.iconBg} flex items-center justify-center`}>
                      <span className={`material-symbols-outlined text-lg ${done ? 'text-emerald-500' : item.iconColor}`}>
                        {item.icon}
                      </span>
                    </div>
                  </div>
                  <p className={`text-base font-bold ${done ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">schedule</span>
                    {item.time}
                  </p>
                </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </motion.div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Recent 1on1 — 一旦非表示 */}
        {false && (
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">forum</span>
              最近の1on1
            </h2>
            <Link href="/hr/one-on-one" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
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
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-base font-bold text-slate-900">{item.employeeName}</p>
                    <p className="text-sm text-slate-500">
                      {item.date && !isNaN(new Date(item.date).getTime())
                        ? new Date(item.date).toLocaleDateString('ja-JP')
                        : '日時未設定'}
                    </p>
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
            <div className="text-center py-8 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 block text-emerald-300">forum</span>
              <p className="text-lg font-bold text-slate-700">まだ1on1の記録がありません</p>
              <p className="text-sm text-slate-500 mt-1">定期的な面談でチームの成長をサポートしましょう</p>
              <Link
                href="/hr/one-on-one"
                className="inline-flex items-center gap-1 mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                1on1を記録する
              </Link>
            </div>
          )}
        </div>

        )}

        {/* Evaluation Periods */}
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">assessment</span>
              評価期間の進捗
            </h2>
            <Link href="/hr/evaluations" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
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
                    <div className="p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-base font-bold text-slate-900">{period.name}</p>
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
                      <p className="text-xs text-slate-500 mt-1">{period.completed}/{period.total}件完了</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 block text-red-300">assessment</span>
              <p className="text-lg font-bold text-slate-700">評価期間が設定されていません</p>
              <p className="text-sm text-slate-500 mt-1">MBO評価をオンラインで管理してみましょう</p>
              <Link
                href="/hr/evaluations"
                className="inline-flex items-center gap-1 mt-4 px-5 py-2.5 bg-red-500 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                評価期間を作成
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-3xl shadow-md p-6">
        <h2 className="text-lg font-black text-slate-900 mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <motion.div key={action.href} whileHover={{ scale: 1.03, y: -2 }}>
              <Link
                href={action.href}
                className="flex items-center gap-3 px-5 py-4 rounded-3xl shadow-md hover:shadow-lg bg-white transition-shadow"
              >
                <div className={`w-10 h-10 rounded-2xl ${action.iconBg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${action.iconColor}`}>{action.icon}</span>
                </div>
                <span className="text-base font-bold text-slate-700">{action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
