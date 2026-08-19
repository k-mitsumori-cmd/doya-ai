'use client'

import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function MensetsuPricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <Link
            href="/mensetsu"
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            <span className="material-symbols-outlined text-lg font-medium">arrow_back</span>
            ドヤ面接官に戻る
          </Link>
          <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
          <p className="mx-auto mt-2 max-w-xl font-bold text-slate-500">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="mensetsu" currentPlan="FREE" />
      </div>
    </div>
  )
}
