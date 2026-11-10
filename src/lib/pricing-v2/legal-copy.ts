// ============================================
// 特定商取引法に基づく表記の料金の文（2026-11-10〜）。
// 三森さんの決定（2026-11-10「いますぐ直す」）で、今の実際の請求（チームの料金）に合わせた。
// ⚠️ 金額・人数・月数はここに書かない。すべて plans.ts と doya-power/rules.ts から計算する（/pricing と1円も違わないように）。
// ⚠️ 料金の形を変える（1人いくら等）ときは、plans.ts の値と、ここの関数だけを直す。ページ（src/app/tokushoho/page.tsx）に数を書かない。
// 表示は税抜で、税込を並べる（2026-11-05 の決定）。据え置きの契約者の額だけは、契約額どおり税込で書く。
// ============================================
import {
  ENTERPRISE_MIN_SEATS,
  FREE_MAX_MEMBERS,
  LEGACY_PRO_PRICE_TAX_INCLUDED,
  POWER_PACK,
  TEAM_BASE_MONTHLY,
  TEAM_SEAT_TIERS,
  YEARLY_FREE_MONTHS,
  withTax,
} from './plans'
import { PURCHASE_MAX_MONTHS } from '../doya-power/rules'

// 新しい料金（チーム）を全員に出した日。2026-11-05 夜に NEW_PRICING_ROLLOUT を all にした（Obsidian ドヤAI_04・05）。
// それより後は 9,980円の新規申し込みを受け付けていない（410 LEGACY_PLAN_CLOSED）。同じ日の朝の申し込みも含めるため「までに」と書く。
export const LEGACY_CUTOFF_LABEL = '2026年11月5日'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`
const exTax = (n: number) => `${yen(n)}（税抜。税込 ${yen(withTax(n))}）`

export function tokushohoPriceLines(): string[] {
  const [first, second] = TEAM_SEAT_TIERS
  return [
    `フリー: ¥0（${FREE_MAX_MEMBERS}人までの会社）`,
    `チーム（月払い）: 基本料 月額 ${exTax(TEAM_BASE_MONTHLY)} ＋ 使う人数1人につき月額 ${exTax(first!.unitMonthly)}。${first!.upTo + 1}人目からは1人につき月額 ${exTax(second!.unitMonthly)}`,
    `チーム（年払い）: 月払いの${12 - YEARLY_FREE_MONTHS}か月分を、1年分としてお支払いいただきます`,
    `${ENTERPRISE_MIN_SEATS}人以上: 個別にお見積りします`,
    `ドヤパワーの追加購入: ${POWER_PACK.points.toLocaleString('ja-JP')}ごとに ${exTax(POWER_PACK.price)}。購入した分は${PURCHASE_MAX_MONTHS}か月で失効します`,
    `${LEGACY_CUTOFF_LABEL}までにプロプランをご契約の方: 月額 ${yen(LEGACY_PRO_PRICE_TAX_INCLUDED)}（税込）のまま変わりません`,
  ]
}

export const TOKUSHOHO_PAYMENT_TIMING = [
  'お申し込み時に、初回の料金をお支払いいただきます。',
  '以降、月払いは毎月、年払いは毎年、お申し込みの日と同じ日に自動でお支払いいただきます。',
  '人数を増やしたときは、増やした分を次のお支払い日までの日割りでお支払いいただきます。',
  'ドヤパワーの追加購入は、購入の時にお支払いいただきます。',
]

export const TOKUSHOHO_REFUND = [
  'デジタルコンテンツの性質上、お支払い後の返品・返金は原則として承っておりません。',
  '人数を減らしたときも、お支払い済みの料金の返金はありません。',
  'ただし、サービスの重大な不具合により利用できない場合は、個別にご相談ください。',
]
