// ============================================
// ドヤ支出管理: 源泉所得税（純粋関数）
// ============================================
// ⚠️ 対象になるかどうか（デザイン・原稿料など）は人が判断して契約に設定する。ここは計算だけ。
// 税率: 1 回の支払額のうち 100 万円以下の部分 10.21%、超える部分 20.42%。円未満切り捨て。
// 基準額: 請求書で消費税額が区分されている前提で、税抜額を基準にする（設計書 §5.5）。
import { addMonthsYm, parseYmd, ymd, type Ymd } from './dates'
import type { WithholdingMode } from './constants'

export function withholdingFor(baseExclTax: number): number {
  if (baseExclTax <= 0) return 0
  if (baseExclTax <= 1_000_000) return Math.floor((baseExclTax * 1021) / 10000)
  return 102_100 + Math.floor(((baseExclTax - 1_000_000) * 2042) / 10000)
}

export type RemittanceBucket = {
  /** 予定の計上月として使う月初日（期間の初日） */
  period: Ymd
  /** 納付期限 */
  dueDate: Ymd
  /** 画面の表示名 */
  label: string
}

/**
 * 報酬を払った日から、源泉税をいつ納めるかを決める。
 * - monthly: 支払った月の翌月 10 日
 * - special（納期の特例）: 1〜6 月の支払分は 7 月 10 日、7〜12 月の支払分は翌年 1 月 20 日
 */
export function remittanceBucket(payDate: Ymd, mode: WithholdingMode): RemittanceBucket {
  const { y, m } = parseYmd(payDate)
  if (mode === 'special') {
    if (m <= 6) return { period: ymd(y, 1, 1), dueDate: ymd(y, 7, 10), label: `源泉所得税 ${y}年1〜6月支払分` }
    return { period: ymd(y, 7, 1), dueDate: ymd(y + 1, 1, 20), label: `源泉所得税 ${y}年7〜12月支払分` }
  }
  const n = addMonthsYm(y, m, 1)
  return { period: ymd(y, m, 1), dueDate: ymd(n.y, n.m, 10), label: `源泉所得税 ${y}年${m}月支払分` }
}
