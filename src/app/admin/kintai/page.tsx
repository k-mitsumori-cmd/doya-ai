'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface KintaiStats {
  totalOrgs: number
  totalEmployees: number
  activeEmployees: number
  pendingInvites: number
  totalClockRecords: number
  todayClockRecords: number
  monthAttendances: number
  totalRequests: number
  pendingRequests: number
}

interface OrgSummary {
  id: string
  name: string
  slug: string
  createdAt: string
  employeeCount: number
  memberCount: number
  departmentCount: number
}

export default function AdminKintaiPage() {
  const [stats, setStats] = useState<KintaiStats | null>(null)
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/kintai')
      .then(r => r.json())
      .then(d => {
        setStats(d.stats || null)
        setOrgs(d.organizations || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-white/40 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">⏰</span>
            ドヤ勤怠 管理
          </h1>
          <p className="text-sm text-white/40 mt-1">サービス運営状況の一覧</p>
        </div>
        <Link
          href="/kintai/dashboard"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          ドヤ勤怠を開く →
        </Link>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="組織数" value={stats.totalOrgs} icon="🏢" color="violet" />
          <StatCard label="全従業員" value={stats.totalEmployees} sub={`有効: ${stats.activeEmployees}`} icon="👥" color="emerald" />
          <StatCard label="招待中" value={stats.pendingInvites} icon="📩" color="amber" />
          <StatCard label="今日の打刻" value={stats.todayClockRecords} icon="⏱️" color="blue" />
          <StatCard label="承認待ち申請" value={stats.pendingRequests} sub={`総申請: ${stats.totalRequests}`} icon="📝" color="orange" />
        </div>
      )}

      {/* Additional Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <p className="text-xs text-white/40 mb-1">累計打刻レコード</p>
            <p className="text-2xl font-bold text-white">{stats.totalClockRecords.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <p className="text-xs text-white/40 mb-1">今月の勤怠データ</p>
            <p className="text-2xl font-bold text-white">{stats.monthAttendances.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <p className="text-xs text-white/40 mb-1">無効従業員</p>
            <p className="text-2xl font-bold text-white">{stats.totalEmployees - stats.activeEmployees}</p>
          </div>
        </div>
      )}

      {/* Organizations Table */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🏢</span> 組織一覧
        </h2>
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-white/40 font-medium">組織名</th>
                <th className="px-5 py-3 text-center text-white/40 font-medium">従業員</th>
                <th className="px-5 py-3 text-center text-white/40 font-medium">部署</th>
                <th className="px-5 py-3 text-left text-white/40 font-medium">作成日</th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-white/30">
                    組織がまだありません
                  </td>
                </tr>
              ) : (
                orgs.map((org) => (
                  <tr key={org.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-white font-medium">{org.name}</p>
                        <p className="text-xs text-white/30">{org.slug}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-white font-bold">{org.employeeCount}</span>
                      <span className="text-white/30 text-xs ml-1">名</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-white/60">{org.departmentCount}</span>
                    </td>
                    <td className="px-5 py-3 text-white/40">
                      {new Date(org.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon, color }: { label: string; value: number; sub?: string; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20',
  }
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.violet} border rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <p className="text-xs text-white/50 font-medium">{label}</p>
      </div>
      <p className="text-3xl font-black text-white">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  )
}
