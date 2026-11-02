'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminBillingData, type AdminBillingData } from './admin-billing-contract'
import type { AdminBillingPeriod } from './admin-billing-period'

interface BillingState {
  period: AdminBillingPeriod
  data: AdminBillingData | null
  pending: boolean
  error: string | null
}

/** 別期間・旧要求の応答を表示せず、通信が止まっても再取得できる状態に戻す。 */
export function useAdminBilling(period: AdminBillingPeriod) {
  const router = useRouter()
  const [state, setState] = useState<BillingState>({ period, data: null, pending: true, error: null })
  const [revision, setRevision] = useState(0)
  const force = useRef(false)
  const refresh = useCallback(() => { force.current = true; setRevision(value => value + 1) }, [])

  useEffect(() => {
    let disposed = false
    let finished = false
    const controller = new AbortController()
    const forceRefresh = force.current
    force.current = false
    setState(previous => ({ period, data: previous.period === period ? previous.data : null, pending: true, error: null }))
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { finished = true; reject(new Error('Billing deadline')); controller.abort() }, 30_000)
    })
    const request = async () => {
      const response = await fetch(`/api/admin/billing/stats?period=${period}${forceRefresh ? '&refresh=1' : ''}`, {
        credentials: 'include', cache: 'no-store', signal: controller.signal,
      })
      if (disposed || finished) return null
      if (response.status === 401) {
        setState({ period, data: null, pending: false, error: '管理者ログインが必要です。' })
        router.push('/admin/login')
        throw new Error('Admin authentication required')
      }
      if (!response.ok) throw new Error('Billing request failed')
      const data: unknown = await response.json()
      if (!isAdminBillingData(data, period)) throw new Error('Invalid billing data')
      return data
    }
    void Promise.race([request(), deadline]).then(data => {
      if (!disposed && data) setState({ period, data, pending: false, error: null })
    }).catch(() => {
      if (!disposed) setState(previous => ({
        period, data: previous.period === period ? previous.data : null, pending: false,
        error: '売上・課金データの取得に失敗しました。再取得してください。',
      }))
    }).finally(() => { finished = true; clearTimeout(timer); controller.abort() })
    return () => { disposed = true; clearTimeout(timer); controller.abort() }
  }, [period, revision, router])

  // useEffectが動く前の描画でも、切替前の期間を新しい選択値と並べない。
  const current = state.period === period ? state : { period, data: null, pending: true, error: null }
  return { data: current.data, error: current.error, isLoading: current.pending && !current.data, isRefreshing: current.pending, refresh }
}
