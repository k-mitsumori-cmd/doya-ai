'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function ShanaiPricingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <Link
            href="/shanai"
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--sub)] hover:text-[var(--sub)]"
          >
            <ArrowLeft className="h-4 w-4" />
            ドヤ社内インタビューに戻る
          </Link>
          <h1 className="text-3xl font-black text-[var(--ink)]">料金プラン</h1>
          <p className="mx-auto mt-2 max-w-xl font-bold text-[var(--sub)]">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="shanai" currentPlan="FREE" />
      </div>
    </div>
  )
}
