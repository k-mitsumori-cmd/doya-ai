// ============================================
// 新しい料金を出すかどうか（旗）
// ============================================
//   NEW_PRICING_ROLLOUT=off      … 誰にも出さない（既定。値が無い・知らない値も off）。今の料金ページのまま
//   NEW_PRICING_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ（src/lib/ui-next.ts の canPreviewUiNext）
//   NEW_PRICING_ROLLOUT=all      … 全員（新しく契約する人）
// ⚠️ 判定はサーバーだけで行う。旗が off なら、新しい料金の Checkout も受け付けない（checkout/route.ts）。
// ⚠️ 旗が on でも、今の契約者には今のプランを出す（view.ts の decidePricingView）。
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export type NewPricingRollout = 'off' | 'preview' | 'all'

export function newPricingRollout(raw: string | undefined = process.env.NEW_PRICING_ROLLOUT): NewPricingRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decideNewPricing(input: { rollout: NewPricingRollout; email: string | null | undefined; allow: string[] }): boolean {
  if (input.rollout === 'all') return true
  if (input.rollout === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/** このメールの人に、新しい料金を出すか（サーバーで使う） */
export function isNewPricingEnabledFor(email: string | null | undefined): boolean {
  return decideNewPricing({ rollout: newPricingRollout(), email, allow: uiPreviewEmails() })
}
