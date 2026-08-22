'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import UpgradeSuccessModal from '@/components/UpgradeSuccessModal'

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
  const [modalPlan, setModalPlan] = useState<'PRO' | 'ENTERPRISE' | null>(null)
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  /** 反映後にUI全体を最新化する（プラン表示・生成上限などを即座に切り替える） */
  const applyToUi = async (planTier: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent('doya:plan-updated', {
          detail: { planTier, source: 'stripe-success-sync', at: Date.now() },
        })
      )
    } catch {}
    await updateSession?.()
    router.refresh()
  }

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams.get('success') !== 'true') return
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return
    handledRef.current = true

    ;(async () => {
      try {
        toast.loading('決済を確認しています…', { id: 'stripe-sync' })
        const res = await fetch('/api/stripe/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'プラン反映に失敗しました')

        toast.dismiss('stripe-sync')
        const tier = String(data?.plan || 'PRO') === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO'
        await applyToUi(tier)
        setModalPlan(tier)
      } catch (e: any) {
        // ここで黙って終わると、利用者は「申し込めていない」と判断してもう一度申し込む
        // （＝二重契約・二重課金。2026-08に実際に発生）。必ず状態と次の操作を見せる。
        toast.dismiss('stripe-sync')
        setFailed(true)
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

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch('/api/stripe/sync/latest', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '反映できませんでした')
      const tier = String(data?.planId || '').includes('enterprise') ? 'ENTERPRISE' : 'PRO'
      await applyToUi(tier)
      setFailed(false)
      setModalPlan(tier)
    } catch (e: any) {
      toast.error(e?.message || '反映できませんでした。お手数ですがお問い合わせください')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      <UpgradeSuccessModal
        isOpen={modalPlan !== null}
        onClose={() => {
          setModalPlan(null)
          router.refresh()
        }}
        planName={modalPlan ?? 'PRO'}
      />

      {/* 反映に失敗したときは「決済は完了している」ことを明示し、再試行だけをさせる。
          ここで何も出さないと再申込＝二重課金を誘発する。 */}
      {failed && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">お支払いは完了しています</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              ご契約の反映処理が一時的に失敗しました。<strong className="text-gray-900">重複してお申し込みされる必要はございません</strong>。
              下のボタンから反映をやり直せます。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex-1 rounded-xl bg-[#0066ff] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {retrying ? '反映しています…' : 'プランを反映する'}
              </button>
              <button
                onClick={() => setFailed(false)}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function StripeSuccessSync() {
  return (
    <Suspense fallback={null}>
      <StripeSuccessSyncInner />
    </Suspense>
  )
}
