'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function DoyaSlidePricingPage() {
  const [plan, setPlan] = useState<string | null>(null)
  const [planError, setPlanError] = useState(false)
  const loadPlan = useCallback(async () => {
    setPlanError(false)
    try {
      const response = await fetch('/api/doyaslide/usage', { cache: 'no-store' })
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

  // 新しい見た目（チェックリスト §5.1）では、枠の中で画面いっぱいの高さを取らず、見出しは枠の h1 に任せて h2 にする（UI 品質 S-57・S-63）
  const Heading = 'h2'

  return (
    <div data-legacy-backdrop>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link
            href="/doyaslide/projects"
            className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            プロジェクトに戻る
          </Link>
          <Heading className="text-2xl font-black text-slate-900">料金プラン</Heading>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        {planError && <div role="alert" className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">現在のプランを確認できませんでした。<button type="button" onClick={() => void loadPlan()} className="ml-2 underline">再読み込み</button></div>}
        <UnifiedPricingPlans serviceId="doyaslide" currentPlan={plan} />
      </div>
    </div>
  )
}
