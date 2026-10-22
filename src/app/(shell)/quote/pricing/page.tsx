'use client'

import Link from 'next/link'
import { OrganizationPricingPlans } from '@/components/OrganizationPricingPlans'
import QuotePageHeading from '@/components/quote/QuotePageHeading'
import { useUiNext } from '@/components/shell/ui-next-context'
import { ArrowLeft } from 'lucide-react'
import { useOptionalQuoteWorkspace } from '@/components/quote/QuoteWorkspaceBoundary'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function QuotePricingPage() {
  const uiNext = useUiNext()
  const scope = useOptionalQuoteWorkspace()?.scope
  return (
    <div className={uiNext ? '' : 'min-h-screen bg-slate-50'}>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <Link
            href={scope?.kind === 'ready' ? scope.proof.href('/quote') : '/quote'}
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            {uiNext ? <ArrowLeft size={18} aria-hidden /> : <span className="material-symbols-outlined text-lg font-semibold">arrow_back</span>}
            ドヤ見積もりAIに戻る
          </Link>
          <QuotePageHeading className="text-3xl font-black text-slate-900">料金プラン</QuotePageHeading>
          <p className="mx-auto mt-2 max-w-xl font-bold text-slate-500">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <OrganizationPricingPlans serviceId="quote" workspaceProof={scope?.kind === 'ready' ? scope.proof : undefined} />
      </div>
    </div>
  )
}
