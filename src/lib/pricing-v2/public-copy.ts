// ============================================
// ログイン前のページ（トップ・各ツールの紹介・資料・llms.txt）に出す料金の文言（2026-11-10〜）。
// 三森さんの決定（2026-11-10）で、ログイン前の料金の表示は /pricing のチームの料金にそろえる。
// ⚠️ 数はここに書かない。すべて plans.ts から計算する（/pricing と1円も違わないように）。
// ⚠️ 前からの契約者の ¥9,980 の案内は、ログインした後の画面にだけ出す（reference/11-billing-spec.md の方針）。ここには入れない。
// ============================================
import {
  FREE_MAX_MEMBERS,
  ENTERPRISE_MIN_SEATS,
  planConfig,
  teamMonthly,
  withTax,
} from './plans'
import { isPerSeatPricingPublic } from './rollout'

// 「1人いくら」の言い方にするか。旗 PER_SEAT_PRICING_ROLLOUT と NEW_PRICING_ROLLOUT がどちらも all のときだけ（rollout.ts）。
// next.config.js がビルドに値を埋め込むので、サーバーとクライアントの部品で同じ言い方になる。
// 旗が off のあいだは、今までの言い方（基本料＋人数）のまま。
const PER_SEAT = isPerSeatPricingPublic()
const MODEL = PER_SEAT ? 'per_seat' : 'base_plus_seat'
const PLAN = planConfig(MODEL)

export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

/** 例として出す人数。/pricing のスライダーの最初の値と同じ人数にする */
export const EXAMPLE_SEATS = 5

const firstSeat = PLAN.tiers[0]!.unitMonthly
const secondSeat = PLAN.tiers[1]?.unitMonthly ?? firstSeat
const secondFrom = PLAN.tiers[0]!.upTo + 1
const exampleMonthly = teamMonthly(EXAMPLE_SEATS, MODEL)!

export const PUBLIC_PRICE = {
  /** 1人いくらの言い方か（true のとき base は 0 で、画面では基本料を出さない） */
  isPerSeat: PER_SEAT,
  freeMembers: FREE_MAX_MEMBERS,
  base: PLAN.baseMonthly,
  perSeat: firstSeat,
  perSeatWithTax: withTax(firstSeat),
  exampleSeats: EXAMPLE_SEATS,
  exampleMonthly,
  exampleMonthlyWithTax: withTax(exampleMonthly),
  enterpriseMin: ENTERPRISE_MIN_SEATS,
} as const

/** 「3人までは無料」 */
export const FREE_LINE = `${FREE_MAX_MEMBERS}人までは無料`

/** 「チームは基本料 ¥9,800＋1人 ¥2,980（税抜）」 */
export const TEAM_LINE = PER_SEAT
  ? `もっと使いたいとき・${FREE_MAX_MEMBERS + 1}人以上で使うときは、1人 月 ${yen(firstSeat)}（税抜。税込 ${yen(withTax(firstSeat))}）です。${secondFrom}人目からは、1人あたりがもっと安くなります`
  : `有料のチームは、基本料 ${yen(PLAN.baseMonthly)}＋使う人数×${yen(firstSeat)}（月額・税抜。${secondFrom}人目からは1人 ${yen(secondSeat)}）`

/** 「5人なら月 ¥24,700（税抜）、税込 ¥27,170」 */
export const EXAMPLE_LINE = `${EXAMPLE_SEATS}人なら月 ${yen(exampleMonthly)}（税抜）、税込 ${yen(withTax(exampleMonthly))}`

/** 1文にまとめた案内（各ツールの紹介ページ・資料・llms.txt 用） */
export const PUBLIC_PRICE_SENTENCE = PER_SEAT
  ? `0円で使えます（${FREE_MAX_MEMBERS}人まで）。${TEAM_LINE}。${EXAMPLE_LINE}。料金は会社ごとで、全ツールを使えます。`
  : `${FREE_LINE}で使えます。${TEAM_LINE}です。${EXAMPLE_LINE}。料金は会社ごとで、全ツールを使えます。`

/** 「人数が増えたら有料のチームへ」の言い方（トップ・料金ページの説明用） */
export const UPGRADE_LEAD = PER_SEAT
  ? `ドヤパワーが足りないときや、${FREE_MAX_MEMBERS + 1}人以上で使うときは、有料のチームへ`
  : '人数が増えたら有料のチームへ'

/** /pricing の meta description の本文（サイト名の後ろに続ける） */
export const PRICING_META_SENTENCE = PER_SEAT
  ? PUBLIC_PRICE_SENTENCE
  : `${FREE_LINE}で、人数が増えたら有料のチームです。${EXAMPLE_LINE}。料金は会社ごとで、全ツールを使えます。`
