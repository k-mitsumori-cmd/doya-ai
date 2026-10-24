'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function IncomePricingPage() {
  // 枠の中では ToolFrame が h1 を持つので、新しい見た目では見出しを h2 にする（見出しを1つにする。S-57）
  const Title = 'h2'
  return (
    <div data-legacy-backdrop className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <Link
            href="/income"
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            ドヤ収入管理に戻る
          </Link>
          <Title className="text-3xl font-black text-slate-900">料金プラン</Title>
          <p className="mx-auto mt-2 max-w-xl font-bold text-slate-500">
            無料で使いはじめて、必要になったらプロプランに切り替えられます。プロプラン1つで、ドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="income" currentPlan="FREE" />
      </div>
    </div>
  )
}
