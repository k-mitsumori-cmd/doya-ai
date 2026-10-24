'use client'

// 月ごとの出金をカテゴリ別に積み上げた棒グラフ（div だけで描く。見込み分は薄い色）
import { CATEGORY_LABEL } from '@/lib/expense/constants'
import { StackedColumnChart } from '@/components/ds/charts'
import { formatCompactJa, TONE_COLOR } from '@/components/ds/chart-math'
import type { ForecastMatrix } from './types'

/**
 * 費目の色。ds の系列の色（SERIES_TONES の順）にそろえ、隣り合う費目を区別しやすくする（統括の指摘 2026-10-23。前は灰色が多かった）。
 * 積み上げの棒（CashColumns）と今月の割合（next.tsx の MonthDonut）で同じ色を使う。見込みは同じ色を薄くする
 */
export const CATEGORY_COLOR: Record<string, string> = {
  saas: TONE_COLOR.blue,
  contractor: TONE_COLOR.pink,
  rent: TONE_COLOR.sky,
  ads: TONE_COLOR.yellow,
  payroll: TONE_COLOR.navy,
  utility: TONE_COLOR.cyan,
  other: TONE_COLOR.muted,
  withholding_tax: TONE_COLOR.blueDeep,
}
/** 「その他」にまとめた分の色 */
export const CATEGORY_OTHER_COLOR = TONE_COLOR.muted
export const colorOf = (c: string) => CATEGORY_COLOR[c] ?? CATEGORY_OTHER_COLOR

export default function CashBars({ cash }: { cash: ForecastMatrix }) {
  return <CashColumns cash={cash} />
}

/** 見込みの色（費目の色を薄くする。凡例の文字にも「見込み」と出す） */
const faint = (color: string) => `color-mix(in srgb, ${color} 40%, transparent)`

/**
 * 新しい見た目: 共通の StackedColumnChart。費目ごとに「確定」と「見込み（薄い色）」を積む。
 * 見込みが1か月も無い費目は、見込みの系列を出さない（凡例を短くするため）
 */
function CashColumns({ cash }: { cash: ForecastMatrix }) {
  const series = cash.categories.flatMap((c) => {
    const name = CATEGORY_LABEL[c] ?? c
    const sure = cash.months.map((m) => {
      const cell = cash.cells[c]?.[m]
      return cell ? Math.max(0, cell.amount - cell.estimated) : 0
    })
    const est = cash.months.map((m) => Math.max(0, cash.cells[c]?.[m]?.estimated ?? 0))
    const out: { name: string; values: number[]; tone: string }[] = []
    if (sure.some((v) => v > 0) || !est.some((v) => v > 0)) out.push({ name, values: sure, tone: colorOf(c) })
    if (est.some((v) => v > 0)) out.push({ name: `${name}（見込み）`, values: est, tone: faint(colorOf(c)) })
    return out
  })
  return (
    <StackedColumnChart
      label="12か月の出金（費目別・見込みは薄い色）"
      labels={cash.months.map((m) => `${Number(m.slice(5))}月`)}
      // 棒の上の合計は短い形（12本並ぶため）。正確な金額は上の表にある
      format={(n) => `${formatCompactJa(n)}円`}
      series={series}
    />
  )
}
