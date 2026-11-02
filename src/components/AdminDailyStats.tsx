'use client'

import { useEffect, useState } from 'react'
import { jstDateKey, jstDayRange } from '@/lib/jst'

type DailyStats = {
  date: string
  timeZone: 'Asia/Tokyo'
  recordedActivities: number
  newUsers: number
  updatedAt: string
}

function validStats(value: unknown, date: string): value is DailyStats {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<DailyStats>
  return data.date === date && data.timeZone === 'Asia/Tokyo'
    && Number.isSafeInteger(data.recordedActivities) && data.recordedActivities! >= 0
    && Number.isSafeInteger(data.newUsers) && data.newUsers! >= 0
    && typeof data.updatedAt === 'string' && Number.isFinite(Date.parse(data.updatedAt))
    && jstDateKey(data.updatedAt) === date
}

export function AdminDailyStats() {
  const [data, setData] = useState<DailyStats | null>(null)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setData(null)
    setError(false)
    const timeout = window.setTimeout(() => {
      controller.abort()
      if (active) setError(true)
    }, 15000)
    const midnight = window.setTimeout(() => {
      setData(null)
      setRefresh(value => value + 1)
    }, Math.max(1, jstDayRange(Date.now()).end.getTime() - Date.now() + 1))
    const reloadVisible = () => {
      if (document.visibilityState === 'visible') {
        setData(null)
        setRefresh(value => value + 1)
      }
    }
    document.addEventListener('visibilitychange', reloadVisible)

    const load = async () => {
      try {
        const response = await fetch('/api/admin/stats/daily', {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok) throw new Error('Stats unavailable')
        const result: unknown = await response.json()
        if (!validStats(result, jstDateKey(Date.now()) || '')) throw new Error('Invalid stats')
        if (active && !controller.signal.aborted) setData(result)
      } catch {
        if (active) setError(true)
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
      window.clearTimeout(midnight)
      document.removeEventListener('visibilitychange', reloadVisible)
    }
  }, [refresh])

  return (
    <section aria-label="本日の統計" className="mt-8 p-4 rounded-xl bg-[#181818] border border-white/10">
      <h2 className="text-xs font-bold text-white/60">本日の統計（日本時間）</h2>
      <div className="mt-3" aria-live="polite" aria-busy={!data && !error}>
        {error ? (
          <div>
            <p className="text-xs text-white/70">統計を取得できませんでした。</p>
            <button type="button" onClick={() => setRefresh(value => value + 1)}
              className="mt-2 px-3 py-2 min-h-11 rounded-lg text-sm font-semibold text-white underline hover:bg-white/10 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              再取得する
            </button>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-lg font-bold text-white">{data.recordedActivities.toLocaleString('ja-JP')}</p>
                <p className="text-xs text-white/60">利用・生成記録</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{data.newUsers.toLocaleString('ja-JP')}</p>
                <p className="text-xs text-white/60">新規ユーザー</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/60">利用・生成の記録は、ログイン後に保存された記録の件数です。</p>
            <p className="mt-2 text-xs text-white/60">
              更新 {new Date(data.updatedAt).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })}
            </p>
            <button type="button" onClick={() => setRefresh(value => value + 1)}
              className="mt-2 px-3 py-2 min-h-11 rounded-lg text-sm font-semibold text-white underline hover:bg-white/10 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              更新する
            </button>
          </>
        ) : (
          <div role="status" aria-label="本日の統計を読み込み中" className="grid grid-cols-2 gap-3">
            {[0, 1].map(key => <div key={key} className="h-12 rounded-lg bg-white/10" />)}
          </div>
        )}
      </div>
    </section>
  )
}
