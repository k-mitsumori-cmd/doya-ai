'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

/**
 * Stripe決済からの戻り（?success=true&session_id=cs_...）を**どのサービスの戻り先でも**検知し、
 * /api/stripe/sync を叩いてプランをDBへ即時反映する。
 *
 * 背景（2026-08 障害）:
 *   決済後の戻り先は checkout API が決めており banner なら `/banner` だが、
 *   同期処理は `/banner/url` にしか実装されていなかった。そのため Stripe Webhook が
 *   不達だと**プランが未来永劫 FREE のまま**になり、実際に有料契約者が無料のまま放置された。
 *   保険は「戻り先ページ」ではなくルートレイアウトに置く（＝全サービス共通で必ず走る）。
 */
function StripeSuccessSyncInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { update: updateSession } = useSession()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams.get('success') !== 'true') return
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return
    handledRef.current = true

    ;(async () => {
      try {
        toast.loading('決済を確認中…（プラン反映中）', { id: 'stripe-sync' })
        const res = await fetch('/api/stripe/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'プラン反映に失敗しました')

        toast.success('プランが有効になりました', { id: 'stripe-sync' })
        try {
          window.dispatchEvent(
            new CustomEvent('doya:plan-updated', {
              detail: { planTier: data?.plan || 'PRO', source: 'stripe-success-sync', at: Date.now() },
            })
          )
        } catch {}
        await updateSession?.()
      } catch (e: any) {
        toast.error(
          e?.message || 'プランの反映に失敗しました。時間をおいて再読み込みしてください',
          { id: 'stripe-sync' }
        )
      } finally {
        // session_id を履歴に残さない（再訪で二重同期しないため）
        try {
          const url = new URL(window.location.href)
          url.searchParams.delete('session_id')
          router.replace(url.pathname + url.search, { scroll: false })
        } catch {}
      }
    })()
  }, [searchParams, router, updateSession])

  return null
}

export default function StripeSuccessSync() {
  return (
    <Suspense fallback={null}>
      <StripeSuccessSyncInner />
    </Suspense>
  )
}
