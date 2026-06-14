'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { DoyaKun } from '@/components/shodan/ui'

export default function AdBannerPricingPage() {
  const { data: session } = useSession()
  const currentPlan = (session?.user as any)?.plan as string | undefined
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-orange-50/40">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <Link href="/adbanner" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4">
            <span className="material-symbols-outlined text-lg">arrow_back</span>ドヤ広告バナーAIに戻る
          </Link>
          <div className="flex justify-center mb-2"><DoyaKun mood="love" size={96} /></div>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">無料でお試し。プロプラン1つで、ドヤAIの全サービスのプロ機能（1日60枚・全サイズ・改善）が使えます。</p>
        </div>
        <UnifiedPricingPlans serviceId="adbanner" currentPlan={currentPlan} />
      </div>
    </div>
  )
}
