'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  industry?: string | null
  region?: string | null
  companyCount?: number
  approachCount?: number
  status: string
  createdAt: string
  updatedAt: string
}

interface UsageData {
  plan?: string
  usage?: {
    creditsUsed?: number
    creditsLimit?: number
    totalProjects?: number
    monthlyUsage?: number
  }
  totals?: {
    projects?: number
    companies?: number
    approaches?: number
  }
}

export default function DoyalistDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const safeFetch = async (url: string) => {
      try {
        const r = await fetch(url)
        if (!r.ok) {
          console.error(`[doyalist dashboard] ${url} responded ${r.status}`)
          return null
        }
        return await r.json()
      } catch (err) {
        console.error(`[doyalist dashboard] ${url} fetch failed:`, err)
        return null
      }
    }
    Promise.all([
      safeFetch('/api/doyalist/projects'),
      safeFetch('/api/doyalist/usage'),
    ])
      .then(([projRes, usageRes]) => {
        if (cancelled) return
        const list: Project[] =
          (Array.isArray(projRes) ? projRes : projRes?.projects) || []
        setProjects(
          list.map((p: Project & { _count?: { companies?: number; approaches?: number } }) => ({
            ...p,
            companyCount: p.companyCount ?? p._count?.companies ?? 0,
            approachCount: p.approachCount ?? p._count?.approaches ?? 0,
          })),
        )
        setUsage(usageRes || {})
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        <p className="text-sm font-bold text-slate-400">ダッシュボードを読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <span className="material-symbols-outlined text-rose-400 text-6xl">error</span>
        <h2 className="text-2xl font-black text-slate-800">読み込みに失敗しました</h2>
        <p className="text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 max-w-lg text-center">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[#7f19e6] text-white font-bold rounded-full shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-all"
        >
          再試行
        </button>
      </div>
    )
  }

  const totalProjects = usage?.totals?.projects ?? usage?.usage?.totalProjects ?? projects.length
  const totalCompanies =
    usage?.totals?.companies ?? projects.reduce((s, p) => s + (p.companyCount || 0), 0)
  const totalApproaches =
    usage?.totals?.approaches ?? projects.reduce((s, p) => s + (p.approachCount || 0), 0)

  const recent = [...projects]
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )
    .slice(0, 5)

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 pb-20">
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-br from-[#7f19e6] via-[#6b13c9] to-[#5b0fb3] p-7 lg:p-10 text-white shadow-xl shadow-[#7f19e6]/20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 60%, white 0%, transparent 40%)',
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold mb-3">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              AIで営業リストを自動生成
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight">営業リストAI</h1>
            <p className="mt-2 text-sm lg:text-base text-white/85 max-w-xl leading-relaxed">
              ターゲット業界・地域・規模を指定するだけで、AIが最適な企業を自動収集。
              分析・スコアリング・アプローチ文面生成まで一気通貫で対応します。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/doyalist/projects/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-[#7f19e6] font-black text-sm shadow-lg hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined">add</span>
              新規プロジェクト
            </Link>
            <Link
              href="/doyalist/projects"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white font-bold text-sm transition-colors"
            >
              <span className="material-symbols-outlined">folder_open</span>
              プロジェクト一覧
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon="folder"
          iconBg="bg-purple-100"
          iconColor="text-[#7f19e6]"
          label="プロジェクト数"
          value={totalProjects}
          unit="件"
        />
        <StatCard
          icon="apartment"
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          label="累計企業数"
          value={totalCompanies}
          unit="社"
        />
        <StatCard
          icon="mark_email_unread"
          iconBg="bg-fuchsia-100"
          iconColor="text-fuchsia-600"
          label="アプローチ数"
          value={totalApproaches}
          unit="件"
        />
      </section>

      {/* Recent projects */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">history</span>
            <h2 className="text-lg font-black text-slate-800">最近のプロジェクト</h2>
          </div>
          <Link
            href="/doyalist/projects"
            className="text-xs font-bold text-[#7f19e6] hover:text-[#5b0fb3] hover:underline transition-colors"
          >
            すべて見る
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-slate-50">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/doyalist/projects/${p.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[#7f19e6]">folder</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate group-hover:text-[#7f19e6] transition-colors">
                      {p.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      {p.industry && <span>{p.industry}</span>}
                      {p.region && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>{p.region}</span>
                        </>
                      )}
                      <span className="text-slate-300">·</span>
                      <span>{new Date(p.createdAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="text-base font-black text-slate-700">
                        {p.companyCount ?? 0}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">企業</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-black text-slate-700">
                        {p.approachCount ?? 0}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">アプローチ</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'archived'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-purple-50 text-[#7f19e6]'
                    }`}
                  >
                    {p.status === 'archived' ? 'アーカイブ' : 'アクティブ'}
                  </span>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-[#7f19e6] transition-colors">
                    chevron_right
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  unit,
}: {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  value: number
  unit: string
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
        </div>
        <p className="text-sm font-bold text-slate-500">{label}</p>
      </div>
      <p className="text-3xl font-black text-slate-800">
        {value.toLocaleString()}
        <span className="text-base text-slate-400 font-bold ml-1">{unit}</span>
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-[#7f19e6] mx-auto mb-4">
        <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
          folder_open
        </span>
      </div>
      <h3 className="text-base font-black text-slate-700 mb-1">まだプロジェクトがありません</h3>
      <p className="text-sm text-slate-400 mb-5">
        最初のプロジェクトを作成して、AI営業リスト生成を始めましょう
      </p>
      <Link
        href="/doyalist/projects/new"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7f19e6] text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 hover:bg-[#5b0fb3] transition-colors"
      >
        <span className="material-symbols-outlined">add</span>
        新規プロジェクト
      </Link>
    </div>
  )
}
