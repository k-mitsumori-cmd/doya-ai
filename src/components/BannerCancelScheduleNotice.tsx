'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, CalendarClock } from 'lucide-react'

type StatusResponse = {
  ok?: boolean
  hasSubscription?: boolean
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: number
  planId?: string | null
  status?: string
  error?: string
}

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

export default function BannerCancelScheduleNotice({ className = '' }: { className?: string }) {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.email
  const [data, setData] = useState<StatusResponse | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/stripe/subscription/status?serviceId=banner', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as StatusResponse
        if (cancelled) return
        setData(res.ok ? json : { error: json?.error || 'failed' })
      } catch (e: any) {
        if (cancelled) return
        setData({ error: e?.message || 'failed' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  const cancelAt = useMemo(() => {
    if (!data?.cancelAtPeriodEnd || !data?.currentPeriodEnd) return null
    const d = new Date(Number(data.currentPeriodEnd) * 1000)
    if (Number.isNaN(d.getTime())) return null
    return d
  }, [data?.cancelAtPeriodEnd, data?.currentPeriodEnd])

  if (!isLoggedIn) return null
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
            <span>停止日時まではPRO/Enterpriseの機能をご利用いただけます（次回更新日で停止）。</span>
          </p>
        </div>
      </div>
    </div>
  )
}


