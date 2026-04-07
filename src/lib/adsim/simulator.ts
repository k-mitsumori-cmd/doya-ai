// ============================================
// ドヤ広告シミュレーションAI - 数値シミュレーションロジック
// ============================================
// 業界平均ベンチマーク × 予算 × 媒体配分 から
// 媒体別×月次のパフォーマンス予測値を算出する

import { getBenchmark, MediaId, MEDIA_OPTIONS } from './benchmark'

export interface SimulateInput {
  industry: string
  monthlyBudget: number
  periodMonths: number
  mediaAllocation: Partial<Record<MediaId, number>> // 各媒体の配分% (合計100)
  avgOrderValue?: number // 想定客単価（ROAS算出用）
}

export interface MonthlyMetrics {
  month: number
  budget: number
  impression: number
  click: number
  ctr: number
  cpc: number
  cv: number
  cvr: number
  cpa: number
  roas: number
}

export interface MediaSimulation {
  mediaId: MediaId
  mediaName: string
  totalBudget: number
  monthly: MonthlyMetrics[]
  summary: {
    impression: number
    click: number
    cv: number
    avgCpa: number
    avgRoas: number
  }
}

export interface SimulationResult {
  media: MediaSimulation[]
  overall: {
    monthlyBudget: number
    totalBudget: number
    totalImpression: number
    totalClick: number
    totalCv: number
    avgCpa: number
    avgRoas: number
  }
}

/**
 * 月次の学習曲線補正
 * 初月はまだ最適化が進んでおらず CVR が低い想定。
 * 月を追うごとに最適化され、3〜4ヶ月目で安定する。
 */
function monthMultiplier(month: number): number {
  if (month === 1) return 0.75
  if (month === 2) return 0.9
  if (month === 3) return 1.0
  return 1.05 // 4ヶ月目以降は微増
}

export function simulate(input: SimulateInput): SimulationResult {
  const benchmark = getBenchmark(input.industry)
  const avgOrderValue = input.avgOrderValue ?? 10000

  const mediaResults: MediaSimulation[] = []

  for (const [mediaIdRaw, pctRaw] of Object.entries(input.mediaAllocation)) {
    const mediaId = mediaIdRaw as MediaId
    const pct = pctRaw ?? 0
    if (pct <= 0) continue
    const mediaBenchmark = benchmark.media[mediaId]
    if (!mediaBenchmark) continue

    const mediaName = MEDIA_OPTIONS.find((m) => m.id === mediaId)?.name || mediaId
    const mediaMonthlyBudget = Math.round((input.monthlyBudget * pct) / 100)

    const monthly: MonthlyMetrics[] = []
    for (let m = 1; m <= input.periodMonths; m++) {
      const mult = monthMultiplier(m)
      const ctr = mediaBenchmark.ctr * mult
      const cvr = mediaBenchmark.cvr * mult
      const cpc = mediaBenchmark.cpc / mult // 最適化でCPC下がる
      const click = Math.round(mediaMonthlyBudget / cpc)
      const impression = Math.round(click / ctr)
      const cv = Math.round(click * cvr)
      const cpa = cv > 0 ? Math.round(mediaMonthlyBudget / cv) : 0
      const roas = mediaMonthlyBudget > 0 ? (cv * avgOrderValue) / mediaMonthlyBudget : 0

      monthly.push({
        month: m,
        budget: mediaMonthlyBudget,
        impression,
        click,
        ctr: Number(ctr.toFixed(4)),
        cpc: Math.round(cpc),
        cv,
        cvr: Number(cvr.toFixed(4)),
        cpa,
        roas: Number(roas.toFixed(2)),
      })
    }

    const sumImp = monthly.reduce((a, b) => a + b.impression, 0)
    const sumClick = monthly.reduce((a, b) => a + b.click, 0)
    const sumCv = monthly.reduce((a, b) => a + b.cv, 0)
    const totalBudget = mediaMonthlyBudget * input.periodMonths

    mediaResults.push({
      mediaId,
      mediaName,
      totalBudget,
      monthly,
      summary: {
        impression: sumImp,
        click: sumClick,
        cv: sumCv,
        avgCpa: sumCv > 0 ? Math.round(totalBudget / sumCv) : 0,
        avgRoas: totalBudget > 0 ? Number(((sumCv * avgOrderValue) / totalBudget).toFixed(2)) : 0,
      },
    })
  }

  // 全体集計
  const totalImp = mediaResults.reduce((a, b) => a + b.summary.impression, 0)
  const totalClick = mediaResults.reduce((a, b) => a + b.summary.click, 0)
  const totalCv = mediaResults.reduce((a, b) => a + b.summary.cv, 0)
  const totalBudget = input.monthlyBudget * input.periodMonths

  return {
    media: mediaResults,
    overall: {
      monthlyBudget: input.monthlyBudget,
      totalBudget,
      totalImpression: totalImp,
      totalClick,
      totalCv,
      avgCpa: totalCv > 0 ? Math.round(totalBudget / totalCv) : 0,
      avgRoas: totalBudget > 0 ? Number(((totalCv * avgOrderValue) / totalBudget).toFixed(2)) : 0,
    },
  }
}
