// ============================================
// 料金ページ /pricing
// ============================================
// 新しい見た目（UI 品質 B-3。src/lib/ui-next.ts）の人には PricingNext、それ以外は今までの料金ページを出す。
// ⚠️ 判定はサーバーで行う（cookie だけでは新しい見た目にならない）。
import { isUiNext } from '@/lib/ui-next'
import PricingNext from '@/components/pricing/PricingNext'
import PricingLegacy from './PricingLegacy'

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isUiNext())) return <PricingLegacy />
  const params = await searchParams
  const canceled = Boolean(params.canceled) || params.payment === 'cancelled'
  return <PricingNext canceled={canceled} />
}
