'use client'

import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { DoyaKun } from '@/components/shodan/ui'

export default function ShodanPricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link href="/shodan" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            ドヤ商談準備に戻る
          </Link>
          <div className="flex justify-center mb-2"><DoyaKun mood="love" size={96} /></div>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
            無料で毎月お試し。プロプラン1つで、ドヤAIの全サービスのプロ機能が使い放題になります。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="shodan" />
      </div>
    </div>
  )
}
