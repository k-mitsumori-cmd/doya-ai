'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminAnalyticsData, type AdminAnalyticsData } from './admin-analytics-contract'

interface AnalyticsState {
  data: AdminAnalyticsData | null
  pending: boolean
  error: string | null
}

/** 読込失敗・タイムアウトを表示し、古い要求と離脱後の応答を無視する。 */
export function useAdminAnalytics() {
  const router = useRouter()
  const [state, setState] = useState<AnalyticsState>({ data: null, pending: true, error: null })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    let disposed = false
    let finished = false
    const controller = new AbortController()
    setState(previous => ({ ...previous, pending: true, error: null }))
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { finished = true; reject(new Error('Analytics deadline')); controller.abort() }, 30_000)
    })
    const request = async () => {
      const response = await fetch('/api/admin/stats', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      if (disposed || finished) return null
      if (response.status === 401) {
        setState({ data: null, pending: false, error: '管理者ログインが必要です。' })
        router.push('/admin/login')
        throw new Error('Admin authentication required')
      }
      if (!response.ok) throw new Error('Analytics request failed')
      const data: unknown = await response.json()
      if (!isAdminAnalyticsData(data)) throw new Error('Invalid analytics data')
      return data
    }
    void Promise.race([request(), deadline]).then(data => {
      if (!disposed && data) setState({ data, pending: false, error: null })
    }).catch(() => {
      if (!disposed) setState(previous => ({ ...previous, pending: false, error: '利用統計の取得に失敗しました。再取得してください。' }))
    }).finally(() => { finished = true; clearTimeout(timer); controller.abort() })
    return () => { disposed = true; clearTimeout(timer); controller.abort() }
  }, [revision, router])

  return { data: state.data, error: state.error, isLoading: state.pending && !state.data, isRefreshing: state.pending, refresh }
}
