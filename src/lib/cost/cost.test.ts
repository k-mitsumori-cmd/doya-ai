import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDailyCostReport, grossProfit, type DailyCostReport } from './format'
import { POWER_COST_BASIS_JPY } from './unit-prices'
import { HEAVY_POWER_COSTS, heavyCostBasis, powerFromCostJpy } from '../doya-power/heavy-costs'
import { DOYA_POWER_COSTS, doyaPowerCost } from '../doya-power/costs'

test('重い処理の量は、原価より安くならない', () => {
  for (const row of heavyCostBasis()) {
    assert.ok(row.power * POWER_COST_BASIS_JPY >= row.costJpy - 1e-9, `${row.action}: ${row.power}pt < ${row.costJpy}円`)
    assert.ok(Number.isInteger(row.power) && row.power >= 1)
  }
})

test('powerFromCostJpy は切り上げ・最低1', () => {
  assert.equal(powerFromCostJpy(0), 1)
  assert.equal(powerFromCostJpy(3), 1)
  assert.equal(powerFromCostJpy(3.01), 2)
  assert.equal(powerFromCostJpy(35), 12)
})

test('表に取り込まれていて、単位を掛けられる', () => {
  for (const k of Object.keys(HEAVY_POWER_COSTS) as (keyof typeof HEAVY_POWER_COSTS)[]) {
    assert.equal(DOYA_POWER_COSTS[k], HEAVY_POWER_COSTS[k])
  }
  assert.equal(doyaPowerCost('video.process.gb', 3), HEAVY_POWER_COSTS['video.process.gb'] * 3)
})

test('文字起こしは既存の表（60分10）を下回らない', () => {
  const t = heavyCostBasis().find((r) => r.action === 'transcribe.hour')!
  assert.ok(DOYA_POWER_COSTS['transcribe.hour'] >= t.power)
})

const base: DailyCostReport = {
  dayLabel: '2026-10-30', monthLabel: '2026-10', dayOfMonth: 31, daysInMonth: 31,
  lines: [
    { label: 'Claude API', dayJpy: 1000, monthJpy: 20000, basis: '実費' },
    { label: 'Gemini API', dayJpy: null, monthJpy: null, basis: '取得できない', note: '未設定' },
  ],
  revenue: { dayGross: 11000, monthGross: 110000, dayFee: 396, monthFee: 3960 },
  acquisition: null, acquisitionNote: '未設定', missingKeys: ['VERCEL_API_TOKEN'],
}

test('粗利の目安: 税抜の売上 − 手数料 − 費用', () => {
  assert.equal(Math.round(grossProfit(11000, 396, 1000)!), 8604)
  assert.equal(grossProfit(null, 0, 0), null)
})

test('文面: 取得できないものは0円と書かず、鍵の名前だけを出す', () => {
  const t = formatDailyCostReport(base)
  assert.match(t, /Gemini API：取得できない/)
  assert.match(t, /取得できない 1 件は含まない/)
  assert.match(t, /VERCEL_API_TOKEN/)
  assert.doesNotMatch(t, /sk-|Bearer/)
  assert.doesNotMatch(t, /[\u{1F300}-\u{1FAFF}]/u)
})

test('文面: 売上が取れないときは粗利を出さない', () => {
  const t = formatDailyCostReport({ ...base, revenue: { dayGross: null, monthGross: null, dayFee: null, monthFee: null, note: 'キー未設定' } })
  assert.match(t, /売上が取得できないため出せない/)
})
