'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminAnalyticsPeriod } from './admin-analytics-period'
import type { AdminAnalyticsPeriodExport } from './admin-analytics-export'
import { isAdminAnalyticsPeriodData } from './admin-analytics-period-contract'

export function useAdminAnalyticsPeriod(period: AdminAnalyticsPeriod) {
  const router = useRouter()
  const [state, setState] = useState<{ data: AdminAnalyticsPeriodExport | null; pending: boolean; error: string | null }>({ data: null, pending: true, error: null })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    let disposed = false, finished = false
    const controller = new AbortController()
    setState(previous => ({ data: previous.data?.period === period ? previous.data : null, pending: true, error: null }))
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { finished = true; controller.abort(); reject(new Error('Analytics deadline')) }, 30_000)
    })
    const request = async () => {
      const response = await fetch(`/api/admin/analytics?period=${period}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      if (disposed || finished) return null
      if (response.status === 401) {
        setState({ data: null, pending: false, error: '管理者ログインが必要です。' })
        router.push('/admin/login')
        return null
      }
      if (!response.ok) throw new Error('Analytics request failed')
      const data: unknown = await response.json()
      if (!isAdminAnalyticsPeriodData(data, period)) throw new Error('Invalid analytics data')
      return data
    }
    void Promise.race([request(), deadline]).then(data => {
      if (!disposed && data) setState({ data, pending: false, error: null })
    }).catch(() => {
      if (!disposed) setState(previous => ({ ...previous, pending: false, error: '期間内の利用統計を取得できませんでした。再取得してください。' }))
    }).finally(() => { finished = true; clearTimeout(timer); controller.abort() })
    return () => { disposed = true; clearTimeout(timer); controller.abort() }
  }, [period, revision, router])
  // A changed selection must never render or export the previous period, even before its effect runs.
  const data = state.data?.period === period ? state.data : null
  return { data, error: data || !state.data ? state.error : null, pending: state.pending || (!!state.data && !data), refresh }
}
