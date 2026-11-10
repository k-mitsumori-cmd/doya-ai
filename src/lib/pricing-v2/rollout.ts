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

/** 旗の値を読む（渡した値だけを見る。環境変数は読まない） */
export function parseNewPricingRollout(raw: string | undefined | null): NewPricingRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 今の旗の値（環境変数 NEW_PRICING_ROLLOUT） */
export function newPricingRollout(raw: string | undefined = process.env.NEW_PRICING_ROLLOUT): NewPricingRollout {
  return parseNewPricingRollout(raw)
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

// ============================================
// 「1人いくら」の料金を出すかどうか（旗 PER_SEAT_PRICING_ROLLOUT。2026-11-10 追加）
// ============================================
//   PER_SEAT_PRICING_ROLLOUT=off      … 基本料ありの今の料金（既定。値が無い・知らない値も off）
//   PER_SEAT_PRICING_ROLLOUT=preview  … UI_PREVIEW_EMAILS で許可した人だけ（ログイン前のページは今の料金のまま）
//   PER_SEAT_PRICING_ROLLOUT=all      … 新しく契約する全員（ログイン前のページも 1人いくら に変わる）
// ⚠️ NEW_PRICING_ROLLOUT が off の人には、この旗が on でも出さない（新しい料金の仕組みの内側だけ）。
// ⚠️ 契約済みの会社の請求・付与は、この旗ではなく「契約の価格 ID」で決める（prices.ts の contractPricingModel）。
// ⚠️ ログイン前のページ（public-copy.ts）は、両方の旗が all のときだけ新しい言い方にする。
//    クライアントの部品でも同じ値になるよう、next.config.js が NEXT_PUBLIC_PER_SEAT_PRICING_PUBLIC をビルドに埋め込む。
export type PerSeatPricingRollout = 'off' | 'preview' | 'all'

export function parsePerSeatPricingRollout(raw: string | undefined | null): PerSeatPricingRollout {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'preview' || v === 'all') return v
  return 'off'
}

/** 今の旗の値（環境変数 PER_SEAT_PRICING_ROLLOUT） */
export function perSeatPricingRollout(raw: string | undefined = process.env.PER_SEAT_PRICING_ROLLOUT): PerSeatPricingRollout {
  return parsePerSeatPricingRollout(raw)
}

/** 判定の中身（テストのため、旗・メール・許可の一覧を引数で受け取る） */
export function decidePerSeatPricing(input: {
  newPricing: NewPricingRollout
  perSeat: PerSeatPricingRollout
  email: string | null | undefined
  allow: string[]
}): boolean {
  // 新しい料金の仕組みそのものを、この人に出していないなら、1人いくらも出さない
  if (!decideNewPricing({ rollout: input.newPricing, email: input.email, allow: input.allow })) return false
  if (input.perSeat === 'all') return true
  if (input.perSeat === 'off') return false
  return canPreviewUiNext(input.email, input.allow)
}

/** このメールの人に、1人いくらの料金を出すか（サーバーで使う） */
export function isPerSeatPricingFor(email: string | null | undefined): boolean {
  return decidePerSeatPricing({ newPricing: newPricingRollout(), perSeat: perSeatPricingRollout(), email, allow: uiPreviewEmails() })
}

/** ログイン前のページ（誰にでも同じ表示）で、1人いくらの言い方を使うか。両方の旗が all のときだけ */
export function isPerSeatPricingPublic(raw: string | undefined = process.env.NEXT_PUBLIC_PER_SEAT_PRICING_PUBLIC): boolean {
  // next.config.js が、両方の旗が all のときだけ 'on' をビルドに埋め込む（サーバーとクライアントで同じ値にするため）
  return raw === 'on'
}
