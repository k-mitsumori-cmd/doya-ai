'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatMinutesJa } from '@/lib/kintai/format'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const router = useRouter()

  useEffect(() => {
    fetch('/api/kintai/dashboard', { credentials: 'include' })
      .then(async (r) => {
        const text = await r.text()
        try {
          const json = JSON.parse(text)
          if (!r.ok || json.error) { setError(json.error || 'APIエラー'); return }
          setData(json)
        } catch { setError('レスポンス解析エラー') }
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <img src="/kintai/characters/thinking_考え中.png" alt="" width={96} height={96} style={{ objectFit: 'contain' }} className="bear-float" />
        <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
        <p className="text-base font-bold text-slate-400">読み込み中...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <img src="/kintai/characters/error_泣き.png" alt="" width={120} height={120} style={{ objectFit: 'contain' }} />
        <h2 className="text-2xl font-black text-slate-800">エラーが発生しました</h2>
        <p className="text-base font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl px-5 py-3 max-w-lg text-center">{error || '不明なエラー'}</p>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-purple-600 text-white font-black rounded-full shadow-lg">再試行する</button>
          <Link href="/kintai" className="px-6 py-3 bg-white text-slate-700 font-bold rounded-full border-2 border-slate-200">トップへ戻る</Link>
        </div>
      </div>
    )
  }

  const emp = data.employee
  const status = data.clockStatus || 'not_clocked_in'
  const summary = data.monthlySummary || { totalWorkDays: 0, totalWorkMinutes: 0, totalOvertimeMinutes: 0, totalLateCount: 0 }

  const timeStr = now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })
  const dateStr = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'long' })
  const hour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours()
  const greeting = hour < 12 ? 'おはようございます' : 'お疲れさまです'

  const statusConfig: Record<string, { label: string; bear: string; color: string; bg: string }> = {
    not_clocked_in: { label: 'まだ出勤していません', bear: '/kintai/characters/sleep_居眠り.png', color: 'text-amber-800', bg: 'bg-gradient-to-br from-amber-100 to-orange-50' },
    working: { label: '勤務中', bear: '/kintai/characters/working_作業中.png', color: 'text-emerald-800', bg: 'bg-gradient-to-br from-emerald-100 to-green-50' },
    on_break: { label: '休憩中', bear: '/kintai/characters/ramen_休憩.png', color: 'text-amber-800', bg: 'bg-gradient-to-br from-amber-100 to-yellow-50' },
    clocked_out: { label: 'お疲れさまでした！', bear: '/kintai/characters/jump_大喜び.png', color: 'text-blue-800', bg: 'bg-gradient-to-br from-blue-100 to-indigo-50' },
  }
  const sc = statusConfig[status] || statusConfig.not_clocked_in

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5 pb-20">
      {/* Hero */}
      <div className={`rounded-3xl ${sc.bg} p-6 shadow-lg relative overflow-hidden`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-base font-bold ${sc.color} opacity-70`}>{dateStr}</p>
            <h1 className={`text-3xl font-black ${sc.color} mt-1`}>{greeting}、{emp?.name || 'ゲスト'}さん</h1>
            <p className={`text-xl font-black ${sc.color} mt-2`}>{sc.label}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`text-4xl font-mono font-black ${sc.color}`}>{timeStr}</p>
            </div>
            <img src={sc.bear} alt="" width={120} height={120} style={{ objectFit: 'contain' }} className="bear-float" />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => router.push('/kintai/clock')}
            className="px-6 py-3 bg-purple-600 text-white font-black rounded-full shadow-lg hover:bg-purple-700 transition-all text-base"
          >
            {status === 'not_clocked_in' ? '⏰ 出勤する' : '⏰ 打刻画面へ'}
          </button>
          <Link href="/kintai/attendance" className="px-6 py-3 bg-white/80 text-slate-700 font-bold rounded-full shadow hover:bg-white transition-all text-base">
            📅 勤怠一覧
          </Link>
        </div>
      </div>

      {/* 月間サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '📅', label: '出勤日数', value: `${summary.totalWorkDays}日`, color: 'bg-blue-50 ring-blue-200 text-blue-800' },
          { icon: '⏱', label: '総勤務時間', value: formatMinutesJa(summary.totalWorkMinutes), color: 'bg-green-50 ring-green-200 text-green-800' },
          { icon: '🌙', label: '残業時間', value: formatMinutesJa(summary.totalOvertimeMinutes), color: 'bg-orange-50 ring-orange-200 text-orange-800' },
          { icon: '⚠️', label: '遅刻回数', value: `${summary.totalLateCount}回`, color: 'bg-red-50 ring-red-200 text-red-800' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl ${s.color} ring-1 p-5 hover:shadow-md transition-all`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{s.icon}</span>
              <span className="text-sm font-bold opacity-70">{s.label}</span>
            </div>
            <p className="text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: '/kintai/clock', bear: '/kintai/characters/working_作業中.png', label: '打刻', bg: 'from-purple-600 to-purple-800' },
          { href: '/kintai/requests/new', bear: '/kintai/characters/point_解説.png', label: '申請', bg: 'from-blue-500 to-indigo-600' },
          { href: '/kintai/attendance', bear: '/kintai/characters/focus_集中.png', label: '勤怠一覧', bg: 'from-emerald-500 to-green-600' },
        ].map((a) => (
          <Link key={a.label} href={a.href} className={`rounded-2xl bg-gradient-to-br ${a.bg} p-5 text-white text-center hover:shadow-xl hover:scale-[1.02] transition-all`}>
            <img src={a.bear} alt="" width={56} height={56} style={{ objectFit: 'contain', margin: '0 auto' }} />
            <p className="text-base font-black mt-2">{a.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
