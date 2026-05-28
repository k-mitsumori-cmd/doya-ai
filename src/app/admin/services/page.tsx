'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ServiceInfo {
  id: string
  name: string
  icon: string
  path: string
  status: string
  stats: Record<string, number>
  color: string
}

const STAT_LABELS: Record<string, string> = {
  articles: '記事数',
  jobs: 'ジョブ数',
  generations: '生成数',
  projects: 'プロジェクト',
  transcriptions: '文字起こし',
  items: 'アイテム',
  organizations: '組織',
  employees: '従業員',
  clockRecords: '打刻',
}

export default function AdminServicesPage() {
  const [data, setData] = useState<{ totalUsers: number; proUsers: number; freeUsers: number; services: ServiceInfo[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/services')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">🚀</span> サービス管理
        </h1>
        <p className="text-sm text-white/40 mt-1">全サービスの利用状況を一覧で確認</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 rounded-2xl p-5">
          <p className="text-xs text-white/50 mb-1">全ユーザー</p>
          <p className="text-3xl font-black text-white">{data.totalUsers.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
          <p className="text-xs text-white/50 mb-1">有料ユーザー</p>
          <p className="text-3xl font-black text-emerald-400">{data.proUsers.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-white/50 mb-1">無料ユーザー</p>
          <p className="text-3xl font-black text-white/60">{data.freeUsers.toLocaleString()}</p>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.services.map(service => {
          const colorMap: Record<string, { bg: string; border: string; text: string }> = {
            emerald: { bg: 'from-emerald-500/15', border: 'border-emerald-500/20', text: 'text-emerald-400' },
            violet: { bg: 'from-violet-500/15', border: 'border-violet-500/20', text: 'text-violet-400' },
            rose: { bg: 'from-rose-500/15', border: 'border-rose-500/20', text: 'text-rose-400' },
            amber: { bg: 'from-amber-500/15', border: 'border-amber-500/20', text: 'text-amber-400' },
            cyan: { bg: 'from-cyan-500/15', border: 'border-cyan-500/20', text: 'text-cyan-400' },
            indigo: { bg: 'from-indigo-500/15', border: 'border-indigo-500/20', text: 'text-indigo-400' },
            pink: { bg: 'from-pink-500/15', border: 'border-pink-500/20', text: 'text-pink-400' },
            purple: { bg: 'from-purple-500/15', border: 'border-purple-500/20', text: 'text-purple-400' },
            blue: { bg: 'from-blue-500/15', border: 'border-blue-500/20', text: 'text-blue-400' },
            teal: { bg: 'from-teal-500/15', border: 'border-teal-500/20', text: 'text-teal-400' },
            orange: { bg: 'from-orange-500/15', border: 'border-orange-500/20', text: 'text-orange-400' },
          }
          const c = colorMap[service.color] || colorMap.violet

          return (
            <div key={service.id} className={`bg-gradient-to-br ${c.bg} to-transparent border ${c.border} rounded-2xl p-5 hover:scale-[1.02] transition-transform`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <p className="text-white font-bold text-sm">{service.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      service.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {service.status === 'active' ? '稼働中' : '準備中'}
                    </span>
                  </div>
                </div>
                <Link href={service.path} className={`text-xs ${c.text} hover:underline`}>
                  開く →
                </Link>
              </div>

              <div className="space-y-2">
                {Object.entries(service.stats).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-white/40">{STAT_LABELS[key] || key}</span>
                    <span className="text-sm font-bold text-white">{val.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
