'use client'

import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { useUiNext } from '@/components/shell/ui-next-context'

// ⚠️ 料金は統一プラン。サービスごとに個別課金しないこと。
//    金額の正本は src/lib/unified-plan.ts と UnifiedPricingPlans。ここには書かない。
export default function AdimagePricingPage() {
  // 新しい見た目（チェックリスト §5.1）では、枠の見出し（h1）と重ならないよう h2 にし、戻るリンク（枠のタブと同じ）を出さない
  const uiNext = useUiNext()
  return (
    <div data-legacy-backdrop className={uiNext ? 'bg-slate-50' : 'min-h-screen bg-slate-50'}>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          {!uiNext && <Link
            href="/adimage"
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            <span className="material-symbols-outlined text-lg font-semibold">arrow_back</span>
            ドヤ広告画像AIに戻る
          </Link>}
          {uiNext ? <h2 className="text-3xl font-black text-slate-900">料金プラン</h2> : <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>}
          <p className="mx-auto mt-2 max-w-xl font-bold text-slate-500">
            無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。
          </p>
        </div>
        <UnifiedPricingPlans serviceId="adimage" currentPlan="FREE" />
      </div>
    </div>
  )
}
