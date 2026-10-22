'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { useUiNext } from '@/components/shell/ui-next-context'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function PopupPricingPage() {
  // 新しい見た目（チェックリスト §5.1）では、枠の中で画面いっぱいの高さを取らず、見出しは枠の h1 に任せて h2 にする（UI 品質 S-57・S-63）
  const uiNext = useUiNext()
  const Heading = uiNext ? 'h2' : 'h1'

  return (
    <div data-legacy-backdrop className={uiNext ? undefined : 'min-h-screen bg-slate-50'}>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <Link
            href="/popup"
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            ドヤポップアップに戻る
          </Link>
          <Heading className={`${uiNext ? 'text-2xl' : 'text-3xl'} font-black text-slate-900`}>料金プラン</Heading>
          <p className="mx-auto mt-2 max-w-xl font-bold text-slate-500">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="popup" currentPlan="FREE" />
      </div>
    </div>
  )
}
