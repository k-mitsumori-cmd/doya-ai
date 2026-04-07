'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import {
  BarChart3,
  Plus,
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  TrendingUp,
  Target,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  Zap,
  ShieldCheck,
} from 'lucide-react'

interface AdSimProject {
  id: string
  name: string
  clientName: string
  industry: string
  productName: string
  status: string
  monthlyBudget: number
  periodMonths: number
  createdAt: string
}

export default function AdSimDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<AdSimProject[]>([])
  const [loading, setLoading] = useState(false)

  const isLoggedIn = !!session?.user
  const isSessionLoading = status === 'loading'

  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace('/auth/signin?callbackUrl=/adsim')
    }
  }, [isSessionLoading, isLoggedIn, router])

  const fetchProjects = () => {
    setLoading(true)
    fetch('/api/adsim/projects?limit=50')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isLoggedIn) fetchProjects()
  }, [isLoggedIn])

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`「${name}」を削除しますか？`)) return
    const res = await fetch(`/api/adsim/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      fetchProjects()
    } else {
      toast.error('削除に失敗しました')
    }
  }

  // KPI 集計
  const stats = useMemo(() => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const monthCount = projects.filter((p) => new Date(p.createdAt) >= startOfMonth).length
    const completed = projects.filter((p) => p.status === 'completed').length
    const totalBudget = projects.reduce((sum, p) => sum + (p.monthlyBudget * p.periodMonths || 0), 0)
    const avgBudget = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.monthlyBudget || 0), 0) / projects.length)
      : 0
    return {
      total: projects.length,
      monthCount,
      completed,
      totalBudget,
      avgBudget,
      remainingThisMonth: Math.max(0, 3 - monthCount),
    }
  }, [projects])

  if (isSessionLoading || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#0017C1]" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F8FB]">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#3460FB] opacity-20 blur-3xl"
          animate={{
            x: [0, 80, -40, 0],
            y: [0, 60, 100, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-[#7096F8] opacity-20 blur-3xl"
          animate={{
            x: [0, -100, 50, 0],
            y: [0, 80, -60, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#0017C1] opacity-15 blur-3xl"
          animate={{
            x: [0, 120, -50, 0],
            y: [0, -80, 40, 0],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#0017C1] to-[#3460FB] shadow-lg shadow-[#0017C1]/20">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">ドヤ広告シミュレーションAI</h1>
              <p className="text-xs text-slate-500">Ad Proposal Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              開発中
            </span>
            <Link
              href="/adsim/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0017C1] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#0017C1]/20 transition hover:bg-[#000060]"
            >
              <Plus className="h-4 w-4" />
              新規提案
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0017C1] via-[#3460FB] to-[#000060] shadow-2xl shadow-[#0017C1]/30"
        >
          <div className="relative px-8 py-12 md:px-12 md:py-14">
            {/* Floating decoration */}
            <motion.div
              className="absolute right-8 top-8 opacity-10"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              <BarChart3 className="h-48 w-48 text-white" />
            </motion.div>
            <motion.div
              className="absolute right-32 bottom-12 h-24 w-24 rounded-full bg-white/10 blur-2xl"
              animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative max-w-2xl">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur"
              >
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </motion.div>
                LP と予算だけで AI が全部やる
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="mb-4 text-4xl font-bold leading-tight text-white md:text-5xl"
              >
                広告提案を、<br className="md:hidden" />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="inline-block"
                >
                  4〜8時間 → <span className="bg-gradient-to-r from-white to-[#D9E6FF] bg-clip-text text-transparent">1分</span>に。
                </motion.span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="mb-8 max-w-xl text-sm text-[#D9E6FF] md:text-base"
              >
                LP と月額予算を入れるだけ。業種・ターゲット・KPI・媒体配分・提案文10セクション・PDF/PPTX/Excel まで AI が全部判断。
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex flex-wrap gap-3"
              >
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/adsim/new"
                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0017C1] shadow-xl transition"
                  >
                    {/* Shimmer */}
                    <motion.span
                      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#0017C1]/10 to-transparent"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                    />
                    <Plus className="relative h-4 w-4" />
                    <span className="relative">新規提案を作成</span>
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/adsim/guide"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    使い方ガイド
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* KPI cards */}
        <motion.div
          className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.4 } } }}
          initial="hidden"
          animate="visible"
        >
          <KpiCard
            label="今月の作成数"
            value={stats.monthCount}
            unit="件"
            sublabel={`残り ${stats.remainingThisMonth} 件作成可能`}
            icon={Clock}
            color="indigo"
          />
          <KpiCard
            label="完了プロジェクト"
            value={stats.completed}
            unit="件"
            sublabel={`総 ${stats.total} 件中`}
            icon={CheckCircle2}
            color="emerald"
          />
          <KpiCard
            label="累計提案予算"
            value={stats.totalBudget > 0 ? Math.round(stats.totalBudget / 10000) : 0}
            unit="万円"
            sublabel="全プロジェクト合算"
            icon={TrendingUp}
            color="blue"
          />
          <KpiCard
            label="平均月予算"
            value={stats.avgBudget > 0 ? Math.round(stats.avgBudget / 10000) : 0}
            unit="万円/月"
            sublabel="プロジェクトあたり"
            icon={Target}
            color="purple"
          />
        </motion.div>

        {/* 機能 + プロジェクト2カラム */}
        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div
            className="space-y-4 lg:col-span-1"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.7 } } }}
            initial="hidden"
            animate="visible"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">主な機能</h3>
            <FeatureCard
              icon={Zap}
              title="入力1分・生成3分"
              desc="LP URL と予算を入れるだけ。Geminiが業種・KPI・媒体配分・提案文を自動判断"
            />
            <FeatureCard
              icon={Layers}
              title="30業種 × 6媒体"
              desc="業界平均ベンチマークで媒体別×月次のIMP/CTR/CV/CPA/ROASを決定論的に算出"
            />
            <FeatureCard
              icon={ShieldCheck}
              title="PDF / PPTX / Excel"
              desc="表紙〜免責までデザイン済み。日本語完全対応。クライアントにそのまま提出可"
            />
          </motion.div>

          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">最近のプロジェクト</h3>
              <Link
                href="/adsim/history"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0017C1] hover:text-[#000060]"
              >
                すべて見る
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0017C1]" />
                </div>
              ) : projects.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="mb-1 text-sm font-medium text-slate-700">まだプロジェクトがありません</p>
                  <p className="mb-4 text-xs text-slate-500">最初の広告提案を作成しましょう</p>
                  <Link
                    href="/adsim/new"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0017C1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#000060]"
                  >
                    <Plus className="h-3 w-3" />
                    新規提案を作成
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {projects.slice(0, 6).map((p, i) => (
                    <motion.li
                      key={p.id}
                      className="group"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + i * 0.06, duration: 0.4 }}
                    >
                      <Link
                        href={`/adsim/${p.id}`}
                        className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#D9E6FF]/40"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#D9E6FF]">
                          <BarChart3 className="h-5 w-5 text-[#0017C1]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{p.clientName}</p>
                            <StatusBadge status={p.status} />
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {p.productName} ・ {p.industry} ・ ¥{(p.monthlyBudget / 10000).toFixed(0)}万/月 × {p.periodMonths}ヶ月
                          </p>
                        </div>
                        <div className="hidden text-right text-xs text-slate-400 sm:block">
                          {new Date(p.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(p.id, p.clientName, e)}
                          className="rounded p-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------
// Components
// ----------------------------------------

function CountUp({ value }: { value: number }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString())
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const controls = animate(count, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] })
    const unsubscribe = rounded.on('change', (v) => setDisplay(v))
    return () => {
      controls.stop()
      unsubscribe()
    }
  }, [value, count, rounded])

  return <>{display}</>
}

function KpiCard({
  label,
  value,
  unit,
  sublabel,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  unit: string
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  color: 'indigo' | 'emerald' | 'blue' | 'purple'
}) {
  const colorMap = {
    indigo: 'bg-[#D9E6FF] text-[#0017C1]',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-[#0017C1]/10"
    >
      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0017C1]/0 to-[#3460FB]/0 opacity-0 transition-opacity group-hover:opacity-5" />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <motion.div
          whileHover={{ rotate: 12, scale: 1.1 }}
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorMap[color]}`}
        >
          <Icon className="h-4 w-4" />
        </motion.div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900 tabular-nums md:text-4xl">
          <CountUp value={value} />
        </span>
        <span className="text-sm font-medium text-slate-500">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
    </motion.div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-[#7096F8] hover:shadow-xl hover:shadow-[#0017C1]/10"
    >
      <motion.div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0017C1] to-[#3460FB] shadow-lg shadow-[#0017C1]/30"
        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
        transition={{ duration: 0.5 }}
      >
        <Icon className="h-5 w-5 text-white" />
      </motion.div>
      <h4 className="mb-1 font-bold text-slate-900">{title}</h4>
      <p className="text-xs leading-relaxed text-slate-600">{desc}</p>
    </motion.div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: '下書き', cls: 'bg-slate-100 text-slate-600' },
    generating: { label: '生成中', cls: 'bg-amber-50 text-amber-700' },
    completed: { label: '完了', cls: 'bg-emerald-50 text-emerald-700' },
    error: { label: 'エラー', cls: 'bg-red-50 text-red-700' },
  }
  const m = map[status] || map.draft
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${m.cls}`}>{m.label}</span>
}
