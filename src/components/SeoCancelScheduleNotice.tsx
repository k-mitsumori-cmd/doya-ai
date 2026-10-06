'use client'

import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus'
import { AlertTriangle, CalendarClock } from 'lucide-react'

function formatJstDateTime(d: Date) {
  try {
    return d.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return d.toISOString()
  }
}

export default function SeoCancelScheduleNotice({ className = '' }: { className?: string }) {
  const { data, error, loading, refresh } = useSubscriptionStatus('seo')
  const cancelAt = data?.hasSubscription && data.cancelAtPeriodEnd ? new Date(data.currentPeriodEnd * 1000) : null
  if (loading) return <p role="status" className={`rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ${className}`}>契約状態を確認しています…</p>
  if (error) return (
    <div role="status" className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}>
      <p>{error}</p>
      <button type="button" disabled={loading} onClick={refresh} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold">契約状態を再確認</button>
    </div>
  )
  if (!cancelAt) return null

  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-200/60 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-amber-900" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-amber-900">
            解約予約中：<span className="underline">{formatJstDateTime(cancelAt)}</span> に停止（日本時間）
          </p>
          <p className="mt-1 text-[11px] font-bold text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-[1px] flex-shrink-0" />
            <span>停止日時までは現在のプランの機能をご利用いただけます（次回更新日で停止）。</span>
          </p>
        </div>
      </div>
    </div>
  )
}


