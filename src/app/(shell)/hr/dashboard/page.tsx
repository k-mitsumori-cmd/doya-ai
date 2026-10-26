'use client'
import { PageTitle } from '@/components/hr/ui-next'
import { Button, EmptyState, StatTile, ToolHero } from '@/components/ds'
import { HeadcountInfo, HeadcountInfoLoading } from '@/components/hr/HrInfographics'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import HrLoadError, { HrStatusError } from '@/components/hr/HrLoadError'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'


interface DashboardStats {
  canManageEmployees: boolean
  canCreatePeriods: boolean
  employeeCount: number
  departmentCount: number
  activeEvaluations: number
  monthlyOneOnOnes: number
  orgName: string
  /** 部署ごとの在籍人数（インフォグラフィック。無ければ空） */
  departmentHeadcount?: { name: string; count: number }[]
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
  { key: 'employeeCount', icon: 'people', label: '従業員数', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', nextIcon: 'Users', unit: '名', href: '/hr/employees' },
  { key: 'departmentCount', icon: 'apartment', label: '部署数', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', nextIcon: 'Building2', unit: '部署', href: '/hr/org-chart' },
  { key: 'activeEvaluations', icon: 'assessment', label: '進行中の評価', iconBg: 'bg-red-100', iconColor: 'text-red-500', nextIcon: 'ClipboardList', unit: '件', href: '/hr/evaluations' },
]

// 新しい見た目: リンクのキーボードの選択を見えるようにする
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue,#0066ff)] focus-visible:ring-offset-2'

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


function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 11) return 'おはようございます！'
  if (hour >= 12 && hour <= 17) return 'お疲れさまです！'
  if (hour >= 18 && hour <= 23) return '今日もお疲れさまでした！'
  return '夜遅くまでお疲れさまです！'
}

export default function HrDashboardPage() {
  const { request: fetch } = useHrOrganizationRequest()
  const [stats, setStats] = useState<DashboardStats>({
    canManageEmployees: false,
    canCreatePeriods: false,
    employeeCount: 0,
    departmentCount: 0,
    activeEvaluations: 0,
    monthlyOneOnOnes: 0,
    orgName: '',
  })
  const [, setRecentOneOnOnes] = useState<RecentOneOnOne[]>([])
  const [evaluationPeriods, setEvaluationPeriods] = useState<EvaluationPeriod[]>([])
  const [loading, setLoading] = useState(true)
  // 失敗の状態コード（分からないときは true）。新しい見た目で出し分けに使う
  const [loadError, setLoadError] = useState<boolean | number>(false)
  // 新しい見た目で、失敗の種類（ログイン・権限・上限）を分けるためのステータス
  const errorStatus = typeof loadError === 'number' ? loadError : undefined
  const [retryKey, setRetryKey] = useState(0)
  // 新しい見た目では、動きを減らす設定のときにキャラクターを揺らさない
  const reduceMotion = useReducedMotion()
  const still = Boolean(reduceMotion)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchDashboard() {
      setLoading(true)
      setLoadError(false)
      try {
        const res = await fetch('/api/hr/dashboard', { cache: 'no-store', signal: controller.signal })
        if (!res.ok) throw new HrStatusError(res.status)
        const data = await res.json()
        if (
          !data || typeof data !== 'object' ||
          typeof data.orgName !== 'string' ||
          typeof data.canManageEmployees !== 'boolean' ||
          typeof data.canCreatePeriods !== 'boolean' ||
          typeof data.employeeCount !== 'number' ||
          typeof data.departmentCount !== 'number' ||
          typeof data.activeEvaluations !== 'number' ||
          typeof data.monthlyOneOnOnes !== 'number' ||
          !Array.isArray(data.recentOneOnOnes) ||
          !Array.isArray(data.evaluationPeriods)
        ) throw new Error('ダッシュボードの応答が不正です')
        if (controller.signal.aborted) return
        setStats({
          canManageEmployees: data.canManageEmployees,
          canCreatePeriods: data.canCreatePeriods,
          employeeCount: data.employeeCount,
          departmentCount: data.departmentCount,
          activeEvaluations: data.activeEvaluations,
          monthlyOneOnOnes: data.monthlyOneOnOnes,
          orgName: data.orgName,
          departmentHeadcount: Array.isArray(data.departmentHeadcount) ? data.departmentHeadcount : [],
        })
        setRecentOneOnOnes(data.recentOneOnOnes)
        setEvaluationPeriods(data.evaluationPeriods)
      } catch (error) {
        if (!controller.signal.aborted) { const status = (error as { status?: unknown } | null)?.status; setLoadError(typeof status === 'number' ? status : true) }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void fetchDashboard()
    return () => controller.abort()
  }, [retryKey])

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <HrLoadError subject="ダッシュボード" status={errorStatus} onRetry={() => setRetryKey((key) => key + 1)} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div role="alert" className="p-6 lg:p-10 max-w-7xl mx-auto">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <PageTitle className="text-xl font-black text-rose-800">ダッシュボードを取得できませんでした</PageTitle>
          <p className="mt-2 text-sm font-bold text-rose-700">組織の情報は変更されていません。時間をおいて再試行してください。</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">
            再試行する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 新しい見た目: ToolHero（キービジュアル・一言の説明・主ボタン1つ）。h1 は ToolFrame が出す */}
      <div className="mb-6">
          <ToolHero
            art="/hr/characters/thumbsup_%E3%81%84%E3%81%84%E3%81%AD.png"
            title={stats.orgName ? <>{stats.orgName}の<wbr />人と組織を、ひと目で</> : '人と組織を、ひと目で'}
            lead={`${getGreeting()} 従業員・部署・評価・1on1の状況を、まとめて確認できます。`}
            action={stats.canManageEmployees ? <Button href="/hr/employees/new" icon="UserPlus">従業員を追加</Button> : undefined}
          />
        </div>
      {/* Header */}

      {/* Stats Cards（新しい見た目: StatTile。押すとそれぞれの一覧へ。読み込み中も高さを確保して押し下げない） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {STAT_CARDS.map((card) => (
            <StatTile
              key={card.key}
              label={card.label}
              icon={card.nextIcon}
              href={card.href}
              value={loading ? <span aria-label="読み込み中" className="inline-block h-8 w-12 rounded bg-slate-100 motion-safe:animate-pulse" /> : (stats as any)[card.key] as number}
              unit={loading ? undefined : card.unit}
            />
          ))}
        </div>

      {/* 部署ごとの人数（インフォグラフィック。2026-10-27） */}
      {loading ? (
        <div className="mb-8"><HeadcountInfoLoading /></div>
      ) : stats.employeeCount > 0 ? (
        <div className="mb-8"><HeadcountInfo rows={stats.departmentHeadcount ?? []} total={stats.employeeCount} /></div>
      ) : null}

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

        {stats.canManageEmployees ? <motion.div
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
              src="/hr/characters/point_%E8%A7%A3%E8%AA%AC.png"
              alt="白くまキャラクター"
              className="hidden sm:block w-40 flex-shrink-0 drop-shadow-lg"
              animate={still ? undefined : { y: [0, -10, 0] }}
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
                  className={`relative block rounded-3xl p-4 transition-all hover:shadow-md ${FOCUS_RING} ${
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
        </motion.div> : (
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-md text-sm font-bold text-slate-600">
            初期設定は組織の管理者が行います。設定が完了すると、従業員や評価の情報をここで確認できます。
          </div>
        )}
        </>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Recent 1on1 — 一旦非表示 */}

        {/* Evaluation Periods */}
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">assessment</span>
              評価期間の進捗
            </h2>
            <Link href="/hr/evaluations" className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-blue-600 hover:text-blue-700 ${FOCUS_RING}`}>
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
                  <Link key={period.id} href={`/hr/evaluations/${period.id}`} className={`block rounded-2xl ${FOCUS_RING}`}>
                    <div className="p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="min-w-0 truncate text-base font-bold text-slate-900">{period.name}</p>
                        <span className="shrink-0 text-base font-black text-blue-600">{pct}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={still ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{period.completed}/{period.total}件完了</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            // 新しい見た目: 空の状態は絵＋次にやること1つ
            <EmptyState
              art="/hr/empty-members.webp"
              title="評価期間はまだありません"
              description={stats.canCreatePeriods ? '評価期間を作ると、MBO評価の進み具合をここで確認できます。' : '管理者が評価期間を作成すると、ここに表示されます。'}
              action={stats.canCreatePeriods ? <Button href="/hr/evaluations" icon="Plus">評価期間を作成</Button> : undefined}
            />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-3xl shadow-md p-6">
        <h2 className="text-lg font-black text-slate-900 mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACTIONS.filter((action) => stats.canManageEmployees || action.href !== '/hr/employees/new').map((action) => (
            <motion.div key={action.href} whileHover={still ? undefined : { scale: 1.03, y: -2 }}>
              <Link
                href={action.href}
                className={`flex items-center gap-3 px-5 py-4 rounded-3xl shadow-md hover:shadow-lg bg-white transition-shadow min-h-11 ${FOCUS_RING}`}
              >
                <div className={`w-10 h-10 rounded-2xl ${action.iconBg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${action.iconColor}`}>{action.icon}</span>
                </div>
                <span className="text-base font-bold text-slate-700">{action.href === '/hr/evaluations' && !stats.canCreatePeriods ? '評価を確認' : action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
