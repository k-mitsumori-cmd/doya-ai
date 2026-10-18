'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function AsklinkPricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <Link
            href="/asklink"
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            ドヤAI質問リンクに戻る
          </Link>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mx-auto mt-2 max-w-xl font-bold text-slate-500">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="asklink" currentPlan="FREE" />
      </div>
    </div>
  )
}
