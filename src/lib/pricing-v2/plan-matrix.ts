// ============================================
// プランの設定の一覧（フリー・チーム・個別見積・据え置き）
// ============================================
// 料金の表（plans.ts）とドヤパワーの決まり（doya-power/rules.ts）から読んで、プランごとに1行にそろえたもの。
// 数はここに書かない（読むだけ）。料金ページ・設計書・テストが、同じ値を見るために使う。
import {
  ENTERPRISE_MIN_SEATS, FREE_MAX_MEMBERS, LEGACY_PRO_MONTHLY_POINTS, LEGACY_PRO_PRICE_TAX_INCLUDED, POWER_PACK,
  YEARLY_FREE_MONTHS, planConfig, type PricingModel,
} from './plans'
import { STARTER_POWER } from './starter-welcome'
import { DAILY_RECOVERY_AMOUNT, DAILY_RECOVERY_CAP, MONTHLY_BONUS_CAP, MONTHLY_CARRYOVER_MONTHS, PURCHASE_MAX_MONTHS } from '../doya-power/rules'

export type PlanRowId = 'free' | 'team' | 'enterprise' | 'legacy'

export interface PlanRow {
  id: PlanRowId
  name: string
  /** 料金の言い方（税抜。据え置きだけ税込） */
  price: string
  /** 会社に入れる人数 */
  members: string
  /** 最初の付与（会社を作ったとき1回） */
  starter: number
  /** 毎月の付与の言い方 */
  monthly: string
  /** 毎日の回復（無ければ 0） */
  dailyRecovery: number
  /** 回復でたまる上限（無ければ 0） */
  recoveryCap: number
  /** 毎月の付与の繰り越し（か月） */
  carryoverMonths: number
  /** 追加購入（1パックの量・税抜の額・有効期限か月）。買えなければ null */
  pack: { points: number; price: number; months: number } | null
  /** はじめの手順・ミッションの付与の月の上限 */
  bonusCap: number
}

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`

/**
 * プランの一覧。model を省くと今の本番（基本料あり）。'per_seat' は 1人いくらの料金（旗 PER_SEAT_PRICING_ROLLOUT が on のとき）。
 * チームの行だけが料金の形で変わる。
 */
export function planMatrix(model: PricingModel = 'base_plus_seat'): readonly PlanRow[] {
  const plan = planConfig(model)
  const teamPrice = model === 'per_seat'
    ? `基本料なし。${plan.tiers.map((t, i) => `${i === 0 ? 1 : plan.tiers[i - 1]!.upTo + 1}〜${t.upTo}人目は1人 ${yen(t.unitMonthly)}`).join('、')}／月。年払いは ${12 - YEARLY_FREE_MONTHS}か月分`
    : `基本料 ${yen(plan.baseMonthly)} ＋ 1人 ${yen(plan.tiers[0]!.unitMonthly)}（11人目から ${yen(plan.tiers[1]!.unitMonthly)}）／月。年払いは ${12 - YEARLY_FREE_MONTHS}か月分`
  const teamMonthly = model === 'per_seat'
    ? plan.tiers.map((t, i) => `${i === 0 ? 1 : plan.tiers[i - 1]!.upTo + 1}〜${t.upTo}人目は1人 ${plan.pointsPerSeatTiers[i]}`).join('、')
    : `${plan.pointsBase.toLocaleString('ja-JP')} ＋ 1人 ${plan.pointsPerSeat}`
  return [
  {
    id: 'free', name: 'フリー', price: '0円',
    members: `${FREE_MAX_MEMBERS}人まで`,
    starter: STARTER_POWER, monthly: 'なし', dailyRecovery: DAILY_RECOVERY_AMOUNT, recoveryCap: DAILY_RECOVERY_CAP, carryoverMonths: 0,
    pack: null, bonusCap: MONTHLY_BONUS_CAP,
  },
  {
    id: 'team', name: 'チーム',
    price: teamPrice,
    members: `1〜${ENTERPRISE_MIN_SEATS - 1}人（買った人数まで）`,
    starter: STARTER_POWER, monthly: teamMonthly,
    dailyRecovery: 0, recoveryCap: 0, carryoverMonths: MONTHLY_CARRYOVER_MONTHS,
    pack: { points: POWER_PACK.points, price: POWER_PACK.price, months: PURCHASE_MAX_MONTHS }, bonusCap: MONTHLY_BONUS_CAP,
  },
  {
    id: 'enterprise', name: '個別見積', price: '見積り',
    members: `${ENTERPRISE_MIN_SEATS}人以上`,
    starter: STARTER_POWER, monthly: '見積り', dailyRecovery: 0, recoveryCap: 0, carryoverMonths: MONTHLY_CARRYOVER_MONTHS,
    pack: { points: POWER_PACK.points, price: POWER_PACK.price, months: PURCHASE_MAX_MONTHS }, bonusCap: MONTHLY_BONUS_CAP,
  },
  {
    id: 'legacy', name: '据え置き（今のプロ）', price: `${yen(LEGACY_PRO_PRICE_TAX_INCLUDED)}／月（税込）`,
    members: '1人（増やすときは相談）',
    starter: STARTER_POWER, monthly: LEGACY_PRO_MONTHLY_POINTS.toLocaleString('ja-JP'),
    dailyRecovery: 0, recoveryCap: 0, carryoverMonths: MONTHLY_CARRYOVER_MONTHS,
    pack: { points: POWER_PACK.points, price: POWER_PACK.price, months: PURCHASE_MAX_MONTHS }, bonusCap: MONTHLY_BONUS_CAP,
  },
  ]
}

/** 今の本番（基本料あり）の一覧 */
export const PLAN_MATRIX: readonly PlanRow[] = planMatrix('base_plus_seat')

export function planRow(id: PlanRowId): PlanRow {
  return PLAN_MATRIX.find((r) => r.id === id)!
}
