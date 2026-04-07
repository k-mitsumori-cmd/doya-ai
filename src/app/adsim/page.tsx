'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
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
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white">
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

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Hero */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0017C1] via-[#3460FB] to-[#000060] shadow-xl shadow-[#0017C1]/20">
          <div className="relative px-8 py-10">
            <div className="absolute right-8 top-8 opacity-10">
              <BarChart3 className="h-40 w-40 text-white" />
            </div>
            <div className="relative max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                <Sparkles className="h-3 w-3" />
                LP と予算だけで AI が全部やる
              </div>
              <h2 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                広告提案を、<br className="md:hidden" />4〜8時間 → 1分に。
              </h2>
              <p className="mb-6 text-sm text-[#D9E6FF] md:text-base">
                LP と月額予算を入れるだけ。業種・ターゲット・KPI・媒体配分・提案文10セクション・PDF/PPTX/Excel まで AI が全部判断。
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/adsim/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-[#0017C1] shadow-lg transition hover:bg-[#D9E6FF]"
                >
                  <Plus className="h-4 w-4" />
                  新規提案を作成
                </Link>
                <Link
                  href="/adsim/guide"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
                >
                  使い方ガイド
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
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
        </div>

        {/* 機能 + プロジェクト2カラム */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">主な機能</h3>
            <FeatureCard
              icon={Zap}
              title="入力1分・生成3分"
              desc="クライアント情報・予算・媒体配分を入れるだけ。Geminiが提案文10セクションを自動執筆"
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
          </div>

          <div className="lg:col-span-2">
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
                  {projects.slice(0, 6).map((p) => (
                    <li key={p.id} className="group">
                      <Link
                        href={`/adsim/${p.id}`}
                        className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------
// Components
// ----------------------------------------

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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</span>
        <span className="text-sm font-medium text-slate-500">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
    </div>
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-[#C5D7FB] hover:shadow-md">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#0017C1] to-[#3460FB]">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h4 className="mb-1 font-bold text-slate-900">{title}</h4>
      <p className="text-xs leading-relaxed text-slate-600">{desc}</p>
    </div>
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
