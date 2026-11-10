// ============================================
// ログイン前のページ（トップ・各ツールの紹介・資料・llms.txt）に出す料金の文言（2026-11-10〜）。
// 三森さんの決定（2026-11-10）で、ログイン前の料金の表示は /pricing のチームの料金にそろえる。
// ⚠️ 数はここに書かない。すべて plans.ts から計算する（/pricing と1円も違わないように）。
// ⚠️ 前からの契約者の ¥9,980 の案内は、ログインした後の画面にだけ出す（reference/11-billing-spec.md の方針）。ここには入れない。
// ============================================
import {
  FREE_MAX_MEMBERS,
  TEAM_BASE_MONTHLY,
  TEAM_SEAT_TIERS,
  ENTERPRISE_MIN_SEATS,
  teamMonthly,
  withTax,
} from './plans'

export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

/** 例として出す人数。/pricing のスライダーの最初の値と同じ人数にする */
export const EXAMPLE_SEATS = 5

const firstSeat = TEAM_SEAT_TIERS[0]!.unitMonthly
const secondSeat = TEAM_SEAT_TIERS[1]!.unitMonthly
const secondFrom = TEAM_SEAT_TIERS[0]!.upTo + 1
const exampleMonthly = teamMonthly(EXAMPLE_SEATS)!

export const PUBLIC_PRICE = {
  freeMembers: FREE_MAX_MEMBERS,
  base: TEAM_BASE_MONTHLY,
  perSeat: firstSeat,
  exampleSeats: EXAMPLE_SEATS,
  exampleMonthly,
  exampleMonthlyWithTax: withTax(exampleMonthly),
  enterpriseMin: ENTERPRISE_MIN_SEATS,
} as const

/** 「3人までは無料」 */
export const FREE_LINE = `${FREE_MAX_MEMBERS}人までは無料`

/** 「チームは基本料 ¥9,800＋1人 ¥2,980（税抜）」 */
export const TEAM_LINE = `有料のチームは、基本料 ${yen(TEAM_BASE_MONTHLY)}＋使う人数×${yen(firstSeat)}（月額・税抜。${secondFrom}人目からは1人 ${yen(secondSeat)}）`

/** 「5人なら月 ¥24,700（税抜）、税込 ¥27,170」 */
export const EXAMPLE_LINE = `${EXAMPLE_SEATS}人なら月 ${yen(exampleMonthly)}（税抜）、税込 ${yen(withTax(exampleMonthly))}`

/** 1文にまとめた案内（各ツールの紹介ページ・資料・llms.txt 用） */
export const PUBLIC_PRICE_SENTENCE = `${FREE_LINE}で使えます。${TEAM_LINE}です。${EXAMPLE_LINE}。料金は会社ごとで、全ツールを使えます。`
