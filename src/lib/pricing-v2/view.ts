// ============================================
// どの料金を見せるか・申し込ませるか（据え置きの見分け）
// ============================================
// 決まり（ユーザーの決定 2026-10-25）: 今まで契約してくれた人は、今の金額のまま据え置く。新しい料金は新しく契約する人から。
// 見分け方: 有料（isPaidPlan）で、今の価格が新しい料金の価格でない人は、すべて「据え置き」。
//   - 統一プロ 9,980円 の契約者、旧ライト・エンタープライズ、運営が手で付けた人（billing_manual_grants）も含む。
//   - 新しい価格の一覧に入っていない価格は、全部「今までの価格」とみなす（安全側。新しい金額で請求しない）。
// ⚠️ DB と Stripe には触らない。呼び出す側が User.plan と User.stripePriceId を渡す。
import { isPaidPlan } from '@/lib/unified-plan'

export type SubscriberKind = 'none' | 'legacy' | 'team'

export function subscriberKind(input: { plan: string | null | undefined; stripePriceId: string | null | undefined; newPriceIds: Set<string> }): SubscriberKind {
  if (!isPaidPlan(input.plan)) return 'none'
  if (input.stripePriceId && input.newPriceIds.has(input.stripePriceId)) return 'team'
  return 'legacy'
}

/**
 * 料金ページの出し分け。
 *   current … 旗が off（または対象外の人）。今の料金ページのまま（無料 / プロ 9,980円）
 *   new     … 新しい料金（まだ契約していない人）
 *   legacy  … 新しい料金のページだが、今の契約（据え置き）を出す。新しい料金の申し込みボタンは出さない
 *   team    … 新しい料金の契約者。今の契約を出す
 */
export type PricingView = 'current' | 'new' | 'legacy' | 'team'

export function decidePricingView(input: { enabled: boolean; kind: SubscriberKind }): PricingView {
  if (!input.enabled) return 'current'
  if (input.kind === 'legacy') return 'legacy'
  if (input.kind === 'team') return 'team'
  return 'new'
}

export type TeamCheckoutDecision =
  | { ok: true }
  | { ok: false; status: number; code: 'NEW_PRICING_DISABLED' | 'NEW_PRICING_NOT_CONFIGURED' | 'LEGACY_KEEPS_PRICE' | 'ALREADY_ON_TEAM' | 'INVALID_SEATS' | 'ENTERPRISE_QUOTE' }

/**
 * 新しい料金（チーム）の Checkout を作ってよいか。
 * ⚠️ 据え置きの人は、ここで必ず止める（新しい金額で請求しない）。プランを変えたい人は設計書 §6.2 の道（運営に相談）を案内する。
 * ⚠️ この判定のあとも、checkout/route.ts の二重契約ガード（Stripe を読む INV-9）は必ず通す。
 */
export function decideTeamCheckout(input: {
  enabled: boolean
  configured: boolean
  kind: SubscriberKind
  seats: unknown
  isValidSeats: (n: unknown) => boolean
  isEnterpriseSeats: (n: number) => boolean
}): TeamCheckoutDecision {
  if (!input.enabled) return { ok: false, status: 404, code: 'NEW_PRICING_DISABLED' }
  if (input.kind === 'legacy') return { ok: false, status: 409, code: 'LEGACY_KEEPS_PRICE' }
  if (input.kind === 'team') return { ok: false, status: 409, code: 'ALREADY_ON_TEAM' }
  if (typeof input.seats === 'number' && input.isEnterpriseSeats(input.seats)) return { ok: false, status: 400, code: 'ENTERPRISE_QUOTE' }
  if (!input.isValidSeats(input.seats)) return { ok: false, status: 400, code: 'INVALID_SEATS' }
  if (!input.configured) return { ok: false, status: 503, code: 'NEW_PRICING_NOT_CONFIGURED' }
  return { ok: true }
}

/**
 * 今のプラン（統一プロ 9,980円 など、チーム以外）の新しい申し込みを受け付けるか。
 * 新しい料金を出している人には、今のプランを新しく売らない（新しい料金より安い今の価格で、新しく契約できてしまうため）。
 * ⚠️ 据え置きの人は止めない（今の契約の中でのプラン変更は、二重契約ガード INV-9 がポータルへ案内する）。
 *    解約して FREE に戻った人は「据え置き」から外れる（設計書 §6.4）。
 */
export function decideLegacyPlanCheckout(input: { enabled: boolean; kind: SubscriberKind }): { ok: true } | { ok: false; status: 410; code: 'LEGACY_PLAN_CLOSED' } {
  // 据え置きの人は通す（このあとの二重契約ガードが、今の契約のプラン変更の画面へ案内する。旧ライト → プロ など）
  if (!input.enabled || input.kind === 'legacy') return { ok: true }
  return { ok: false, status: 410, code: 'LEGACY_PLAN_CLOSED' }
}
