'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

export type PlanUpdatedDetail = {
  serviceId?: 'banner' | 'seo' | 'kantan' | 'bundle'
  planTier?: 'FREE' | 'PRO' | 'ENTERPRISE' | 'BUSINESS' | 'BUNDLE'
  source?: 'stripe-sync' | 'stripe-webhook' | 'manual'
  at?: number
}

/**
 * 決済直後など「プランが更新された」イベントをアプリ全体へブロードキャストし、
 * 受け取った側で session.update() / router.refresh() を実行して即時反映させる。
 */
export default function PlanUpdatedListener() {
  const router = useRouter()
  const { update } = useSession()

  useEffect(() => {
    const onPlanUpdated = async (ev: Event) => {
      try {
        const detail = (ev as CustomEvent<PlanUpdatedDetail>)?.detail || {}
        toast.success('プランが更新されました', { id: 'plan-updated' })
        await update?.()
        // サーバーコンポーネント/キャッシュも更新
        router.refresh()
        // 他のUIがlistenしたい場合に備えてlocalStorageにも残す（同一タブ内）
        try {
          localStorage.setItem('doya:plan-updated:last', JSON.stringify({ ...detail, at: Date.now() }))
        } catch {}
      } catch (e) {
        console.error('PlanUpdatedListener error:', e)
      }
    }

    window.addEventListener('doya:plan-updated', onPlanUpdated as any)
    return () => window.removeEventListener('doya:plan-updated', onPlanUpdated as any)
  }, [router, update])

  return null
}


