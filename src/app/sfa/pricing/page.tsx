'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function SfaPricingPage() {
  const [plan, setPlan] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [planError, setPlanError] = useState(false)
  const [loading, setLoading] = useState(true)
  const loadPlan = useCallback(async () => {
    setPlanError(false)
    setLoading(true)
    try {
      const org = new URLSearchParams(window.location.search).get('org')
      const response = await fetch(org ? `/api/sfa/usage?org=${encodeURIComponent(org)}` : '/api/sfa/usage', { cache: 'no-store' })
      if (!response.ok) throw new Error('プランを確認できませんでした')
      const data = await response.json()
      if (data.onboarded === false) {
        if (org) throw new Error('組織を確認できませんでした')
        setPlan(null)
        setRole(null)
        return
      }
      if (typeof data.plan !== 'string' || typeof data.role !== 'string') throw new Error('プランの応答が不正です')
      setPlan(data.plan)
      setRole(data.role)
    } catch {
      setPlan(null)
      setRole(null)
      setPlanError(true)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link href="/sfa" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        {planError && <div role="alert" className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">現在のプランを確認できませんでした。<button type="button" onClick={() => void loadPlan()} className="ml-2 underline">再読み込み</button></div>}
        {loading && <p className="text-center text-sm font-bold text-slate-500">組織のプランを確認しています…</p>}
        {!loading && !planError && role && role !== 'owner' && (
          <div role="status" className="mx-auto max-w-xl rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-blue-900">
            この組織の現在のプランは{plan}です。利用枠の変更は組織の契約者にご相談ください。
          </div>
        )}
        {!loading && !planError && (!role || role === 'owner') && <UnifiedPricingPlans serviceId="sfa" currentPlan={plan} />}
      </div>
    </div>
  )
}
