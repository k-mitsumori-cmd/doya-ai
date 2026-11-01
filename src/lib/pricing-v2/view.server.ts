// ============================================
// 料金ページの出し分けを、サーバーで決める
// ============================================
// ⚠️ 旗が off なら、DB を読まずに 'current'（今の料金ページのまま）。
// ⚠️ DB を読めないときも 'current'（据え置きかどうか分からない人に、新しい料金の申し込みを出さない）。
// 見本の表示（DS_PREVIEW=1 のときだけ。本番の環境変数には置かない）: /pricing?pricing=new|legacy|team
import { prisma } from '@/lib/prisma'
import { isNewPricingEnabledFor } from './rollout'
import { newPricingPriceIds } from './prices'
import { decidePricingView, subscriberKind, type PricingView } from './view'

const PREVIEW_VIEWS = new Set<PricingView>(['new', 'legacy', 'team', 'current'])

export async function resolvePricingView(email: string | null | undefined, previewParam?: string | string[]): Promise<PricingView> {
  if (process.env.DS_PREVIEW === '1' && typeof previewParam === 'string' && PREVIEW_VIEWS.has(previewParam as PricingView)) {
    return previewParam as PricingView
  }
  if (!isNewPricingEnabledFor(email)) return 'current'
  if (!email) return 'new'
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { plan: true, stripePriceId: true } })
    const kind = subscriberKind({ plan: user?.plan, stripePriceId: user?.stripePriceId, newPriceIds: newPricingPriceIds() })
    return decidePricingView({ enabled: true, kind })
  } catch {
    console.error('[pricing] could not read the plan for the pricing view')
    return 'current'
  }
}
