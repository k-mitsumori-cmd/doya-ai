// ============================================
// 新しい料金の表（組織単位・2026-10-25 案）
// ============================================
// ⚠️ 金額・付与のポイント・人数の段階は、ここだけに書く。料金ページ・Checkout・テストはこの表から読む。
// 案C を正式の案にした（2026-10-25 ユーザー「こちらの内容で進めてください」）。公開（旗 NEW_PRICING_ROLLOUT を on）は統括がユーザーの承認を取って行う。
// ⚠️ 今の契約者（1人 9,980円 の統一プロ）は、今の金額のまま据え置く（legacy.ts）。この表の金額で請求しない。
// 設計書: docs/architecture/management-agent/PRICING-NEW-2026-10-25.md
// DB にも Stripe にも触らない（計算だけ）。テスト: pricing-v2.test.ts

/** 表示の金額は税抜（法人向けの慣行）。Stripe の価格は税込の額で作る（設計書 §7） */
export const TAX_RATE = 0.1

/** フリーで使える人数の上限 */
export const FREE_MAX_MEMBERS = 3

/** チームの基本料（月額・税抜） */
export const TEAM_BASE_MONTHLY = 9800

/**
 * 人数の段階（月額・税抜・1人あたり）。Stripe では「段階別（graduated）」の1つの価格で作る。
 * upTo は「この人数目まで」。最後の段階の upTo は、個別見積の手前（ENTERPRISE_MIN_SEATS - 1）。
 */
export const TEAM_SEAT_TIERS: readonly { upTo: number; unitMonthly: number }[] = [
  { upTo: 10, unitMonthly: 2980 },
  { upTo: 49, unitMonthly: 2480 },
]

/** この人数から個別見積（請求書払い・年契約が基本） */
export const ENTERPRISE_MIN_SEATS = 50

/** チームの最小人数（1人の会社でも申し込める） */
export const TEAM_MIN_SEATS = 1

/** 年払いは、2か月分を引く（＝月額 × 10） */
export const YEARLY_FREE_MONTHS = 2

/** ドヤパワーの毎月の付与（チーム）: 基本 ＋ 1人ごと。年払いでも毎月付ける（まとめて付けない） */
export const TEAM_MONTHLY_POINTS_BASE = 1500
export const TEAM_MONTHLY_POINTS_PER_SEAT = 300

/**
 * 今の 1人 9,980円 の契約者（据え置き）への毎月の付与。
 * src/lib/doya-power/rules.ts の SOLO_PRO_MONTHLY_GRANT はここを読む。
 * 2026-10-25 ユーザー決定: 仮の 3,000 から 1,500 に下げた（3,000 は全部使われると原価が売上を上回る。設計書 §4.6）。
 */
export const LEGACY_PRO_MONTHLY_POINTS = 1500

/** 追加購入（1パック）。有効期限は doya-power/rules.ts の PURCHASE_MAX_MONTHS（6か月）に従う */
export const POWER_PACK = { points: 1000, price: 5980 } as const

/** 今の統一プロ（据え置き）の月額（税込）。表示と比較のためだけ。請求は Stripe の既存の価格のまま */
export const LEGACY_PRO_PRICE_TAX_INCLUDED = 9980

/** 粗利の確認に使う原価の見込み（1ポイントあたりの円）。設計書 §4 */
export const COST_PER_POINT_WORST = 4
export const COST_PER_POINT_TYPICAL = 3
/** Stripe の手数料（国内カード）の見込み */
export const STRIPE_FEE_RATE = 0.036

export type BillingInterval = 'monthly' | 'yearly'

export interface SeatLine {
  from: number
  to: number
  seats: number
  unitMonthly: number
  subtotalMonthly: number
}

/** 人数として正しいか（チームで申し込める範囲。50人以上は個別見積なので false） */
export function isTeamSeatCount(seats: unknown): seats is number {
  return typeof seats === 'number' && Number.isInteger(seats) && seats >= TEAM_MIN_SEATS && seats < ENTERPRISE_MIN_SEATS
}

/** 個別見積の人数か */
export function isEnterpriseSeatCount(seats: number): boolean {
  return Number.isFinite(seats) && seats >= ENTERPRISE_MIN_SEATS
}

/** 人数の内訳（段階ごと）。範囲外は空 */
export function seatBreakdown(seats: number): SeatLine[] {
  if (!isTeamSeatCount(seats)) return []
  const out: SeatLine[] = []
  let from = 1
  for (const t of TEAM_SEAT_TIERS) {
    if (from > seats) break
    const to = Math.min(seats, t.upTo)
    const n = to - from + 1
    if (n > 0) out.push({ from, to, seats: n, unitMonthly: t.unitMonthly, subtotalMonthly: n * t.unitMonthly })
    from = t.upTo + 1
  }
  return out
}

/** 人数の分の月額（税抜） */
export function seatsMonthly(seats: number): number | null {
  if (!isTeamSeatCount(seats)) return null
  return seatBreakdown(seats).reduce((s, l) => s + l.subtotalMonthly, 0)
}

/** チームの月額（税抜）＝基本料＋人数の分。範囲外は null（50人以上は個別見積） */
export function teamMonthly(seats: number): number | null {
  const s = seatsMonthly(seats)
  return s === null ? null : TEAM_BASE_MONTHLY + s
}

/** チームの年額（税抜）＝月額 × (12 − 2) */
export function teamYearly(seats: number): number | null {
  const m = teamMonthly(seats)
  return m === null ? null : m * (12 - YEARLY_FREE_MONTHS)
}

/** 請求の単位ごとの額（税抜） */
export function teamPrice(seats: number, interval: BillingInterval): number | null {
  return interval === 'yearly' ? teamYearly(seats) : teamMonthly(seats)
}

/** 税込の額（円未満は切り捨て） */
export function withTax(amount: number): number {
  return Math.floor(amount * (1 + TAX_RATE))
}

/** チームの毎月の付与ポイント */
export function teamMonthlyPoints(seats: number): number | null {
  if (!isTeamSeatCount(seats)) return null
  return TEAM_MONTHLY_POINTS_BASE + TEAM_MONTHLY_POINTS_PER_SEAT * seats
}

/** 粗利率の見込み（0〜1）。usage は付与ポイントのうち使う割合、costPerPoint は1ポイントの原価 */
export function grossMarginRate(input: { revenueMonthly: number; points: number; usage: number; costPerPoint: number }): number {
  const { revenueMonthly, points, usage, costPerPoint } = input
  if (!(revenueMonthly > 0)) return 0
  const fee = withTax(revenueMonthly) * STRIPE_FEE_RATE
  return (revenueMonthly - fee - points * usage * costPerPoint) / revenueMonthly
}

/** 料金ページに出すプランの見出し（文言はここで持つ。絵文字は使わない） */
export const PLAN_COPY = {
  free: {
    name: 'フリー',
    lead: '3人までの会社で、まずは無料で使えます。',
    points: 'ドヤパワーが毎日10ずつ回復します（たまる上限は100）。',
  },
  team: {
    name: 'チーム',
    lead: '基本料に、使う人数の分を足した料金です。11人目からは1人あたりが安くなります。',
  },
  enterprise: {
    name: '個別見積',
    lead: `${ENTERPRISE_MIN_SEATS}人以上の会社は、人数と使い方に合わせてお見積りします。請求書払いにも対応します。`,
  },
} as const
