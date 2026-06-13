'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function DoyaSlidePricingPage() {
  const [plan, setPlan] = useState<string>('FREE')
  useEffect(() => {
    fetch('/api/doyaslide/usage')
      .then((r) => r.json())
      .then((d) => setPlan(d.plan || 'FREE'))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link
            href="/doyaslide/projects"
            className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            プロジェクトに戻る
          </Link>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="doyaslide" currentPlan={plan} />
      </div>
    </div>
  )
}
