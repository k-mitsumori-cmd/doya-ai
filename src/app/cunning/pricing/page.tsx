'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function CunningPricingPage() {
  const [plan, setPlan] = useState<string | null>(null)
  const [planError, setPlanError] = useState(false)
  const loadPlan = useCallback(async () => {
    setPlanError(false)
    try {
      const response = await fetch('/api/cunning/usage', { cache: 'no-store' })
      if (!response.ok) throw new Error('プランを確認できませんでした')
      const data = await response.json()
      if (typeof data.plan !== 'string') throw new Error('プランの応答が不正です')
      setPlan(data.plan)
    } catch {
      setPlan(null)
      setPlanError(true)
    }
  }, [])
  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link
            href="/cunning"
            className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            ライブに戻る
          </Link>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        {planError && <div role="alert" className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">現在のプランを確認できませんでした。<button type="button" onClick={() => void loadPlan()} className="ml-2 underline">再読み込み</button></div>}
        <UnifiedPricingPlans serviceId="cunning" currentPlan={plan} />
      </div>
    </div>
  )
}
