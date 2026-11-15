'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ServiceStatus } from '@/lib/services'

interface ServiceInfo {
  id: string
  name: string
  icon: string
  path: string
  status: ServiceStatus
  limited?: boolean
  stats: Record<string, number>
  color: string
}

const STAT_LABELS: Record<string, string> = {
  articles: '記事数',
  jobs: 'ジョブ数',
  generations: '利用・生成記録',
  projects: 'プロジェクト',
  transcriptions: '文字起こし',
  organizations: '組織',
  employees: '従業員',
  clockRecords: '打刻',
}

const STATUS_LABELS: Record<ServiceStatus, string> = {
  active: '稼働中',
  beta: 'ベータ版',
  coming_soon: '準備中',
  maintenance: 'メンテナンス中',
}

interface ServicesData {
  totalUsers: number
  proUsers: number
  freeUsers: number
  services: ServiceInfo[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isServiceInfo(value: unknown): value is ServiceInfo {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
    && typeof value.icon === 'string' && typeof value.path === 'string'
    && typeof value.status === 'string' && Object.hasOwn(STATUS_LABELS, value.status)
    && (value.limited === undefined || typeof value.limited === 'boolean') && typeof value.color === 'string'
    && isRecord(value.stats) && Object.values(value.stats).every(isCount)
}

function isServicesData(value: unknown): value is ServicesData {
  return isRecord(value) && isCount(value.totalUsers) && isCount(value.proUsers)
    && isCount(value.freeUsers) && value.totalUsers - value.proUsers === value.freeUsers
    && Array.isArray(value.services) && value.services.every(isServiceInfo)
}

type LoadState =
  | { status: 'loading' | 'failed' | 'unauthorized' }
  | { status: 'ready'; data: ServicesData }

export default function AdminServicesPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => {
      if (active) setState({ status: 'failed' })
      active = false
      controller.abort()
    }, 30_000)

    async function load() {
      try {
        const response = await fetch('/api/admin/services', { cache: 'no-store', signal: controller.signal })
        if (!active) return
        if (response.status === 401) {
          setState({ status: 'unauthorized' })
          return
        }
        if (!response.ok) throw new Error('Service statistics request failed')
        const data: unknown = await response.json()
        if (!isServicesData(data)) throw new Error('Invalid service statistics')
        if (active) setState({ status: 'ready', data })
      } catch {
        if (active) setState({ status: 'failed' })
      } finally {
        clearTimeout(timeout)
      }
    }

    void load()
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  if (state.status === 'loading') {
    return (
      <div className="p-6 lg:p-8" role="status">
        <p className="text-sm text-white/60">サービスの集計を読み込んでいます。</p>
      </div>
    )
  }

  if (state.status === 'unauthorized') {
    return (
      <div className="p-6 lg:p-8 space-y-3">
        <p role="alert" className="text-sm text-red-300">管理者としてログインしてください。</p>
        <Link href="/admin/login" className="text-sm font-semibold text-violet-300 underline">管理者ログイン</Link>
      </div>
    )
  }

  if (state.status !== 'ready') {
    return (
      <div className="p-6 lg:p-8 space-y-3">
        <p role="alert" className="text-sm text-red-300">サービスの集計を取得できませんでした。</p>
        <button type="button" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300" onClick={() => {
          setState({ status: 'loading' })
          setAttempt(value => value + 1)
        }}>
          再取得
        </button>
      </div>
    )
  }

  const { data } = state

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
          <p className="text-xs text-white/50 mb-1">有料プラン登録者</p>
          <p className="text-3xl font-black text-emerald-400">{data.proUsers.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
          <p className="text-xs text-white/50 mb-1">その他の登録者</p>
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
          const stats = Object.entries(service.stats)

          return (
            <div key={service.id} className={`bg-gradient-to-br ${c.bg} to-transparent border ${c.border} rounded-2xl p-5 hover:scale-[1.02] transition-transform`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{service.icon}</span>
                  <div>
                    <p className="text-white font-bold text-sm">{service.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      service.status === 'active' && !service.limited ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {service.limited ? '限定公開' : STATUS_LABELS[service.status]}
                    </span>
                  </div>
                </div>
                <Link href={service.path} className={`text-xs ${c.text} hover:underline`}>
                  開く →
                </Link>
              </div>

              <div className="space-y-2">
                {stats.length === 0 ? (
                  <p className="text-sm text-white/60">未集計</p>
                ) : stats.map(([key, val]) => (
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
