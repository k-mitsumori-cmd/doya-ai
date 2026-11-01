'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { userErrorMessage, KINTAI_NETWORK_ERROR } from '@/lib/kintai/user-error'
import { useKintaiAccess } from '@/components/kintai/KintaiAccessContext'
import KintaiDashboardNext, { KintaiDashboardError, KintaiDashboardLoading } from '@/components/kintai/KintaiDashboardNext'

export default function DashboardPage() {
  const { isActive } = useKintaiAccess()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    fetch('/api/kintai/dashboard', { credentials: 'include' })
      .then(async (r) => {
        const text = await r.text()
        try {
          const json = JSON.parse(text)
          if (!r.ok || json.error) { setError(userErrorMessage(json.error, '少し待って、もう一度お試しください。')); return }
          setData(json)
        } catch { setError('少し待って、もう一度お試しください。') }
      })
      .catch(() => setError(KINTAI_NETWORK_ERROR))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <KintaiDashboardLoading />
  if ((error || !data)) return <KintaiDashboardError message={error || '少し待って、もう一度お試しください。'} />

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <img src="/kintai/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png" alt="" width={96} height={96} style={{ objectFit: 'contain' }} className="bear-float" />
        <div className="w-10 h-10 rounded-full border-4 border-brand-100 border-t-brand-500 animate-spin" />
        <p className="text-base font-bold text-slate-400">読み込み中...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <img src="/kintai/characters/error_%E6%B3%A3%E3%81%8D.png" alt="" width={120} height={120} style={{ objectFit: 'contain' }} />
        <h2 className="text-2xl font-black text-slate-800">エラーが発生しました</h2>
        <p className="text-base font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl px-5 py-3 max-w-lg text-center">{error || '不明なエラー'}</p>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-brand-500 text-white font-black rounded-full shadow-lg">再試行する</button>
          <Link href="/kintai" className="px-6 py-3 bg-white text-slate-700 font-bold rounded-full border-2 border-slate-200">トップへ戻る</Link>
        </div>
      </div>
    )
  }

  const emp = data.employee
  const status = data.clockStatus || 'not_clocked_in'
  const summary = data.monthlySummary || { totalWorkDays: 0, totalWorkMinutes: 0, totalOvertimeMinutes: 0, totalLateCount: 0 }

  return <KintaiDashboardNext name={emp?.name || 'ゲスト'} status={status} now={now} summary={summary} isActive={isActive} />
}
