// ============================================
// adsim simulator ユニットテスト
// 実行: cd 09_Cursol && npx tsx scripts/test-adsim-simulator.ts
// ============================================

import { simulate, SimulateInput } from '../src/lib/adsim/simulator'
import { INDUSTRY_BENCHMARKS, MEDIA_OPTIONS, getBenchmark } from '../src/lib/adsim/benchmark'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    const msg = `  ✗ ${name}${detail ? `\n    ${detail}` : ''}`
    failures.push(msg)
    console.log(msg)
  }
}

function group(name: string, fn: () => void) {
  console.log(`\n[${name}]`)
  fn()
}

// ============================================
// Test 1: ベンチマークデータの整合性
// ============================================
group('benchmark data integrity', () => {
  assert('30業種が登録されている', INDUSTRY_BENCHMARKS.length === 30,
    `actual: ${INDUSTRY_BENCHMARKS.length}`)

  assert('業種IDが重複していない', new Set(INDUSTRY_BENCHMARKS.map(b => b.id)).size === INDUSTRY_BENCHMARKS.length)

  for (const b of INDUSTRY_BENCHMARKS) {
    const mediaCount = Object.keys(b.media).length
    if (mediaCount !== 6) {
      assert(`${b.id}: 6媒体すべて持つ`, false, `actual: ${mediaCount}`)
    }
  }
  assert('全業種が6媒体すべてを持つ', INDUSTRY_BENCHMARKS.every(b => Object.keys(b.media).length === 6))

  assert('"other" 業種が存在する', INDUSTRY_BENCHMARKS.some(b => b.id === 'other'))

  assert('全ベンチマーク値が正の数', INDUSTRY_BENCHMARKS.every(b =>
    Object.values(b.media).every(m => m.cpm > 0 && m.ctr > 0 && m.cpc > 0 && m.cvr > 0)
  ))
})

// ============================================
// Test 2: 媒体マスタ
// ============================================
group('media options', () => {
  assert('6媒体登録されている', MEDIA_OPTIONS.length === 6)
  const ids = MEDIA_OPTIONS.map(m => m.id)
  assert('Google含む', ids.includes('google'))
  assert('Meta含む', ids.includes('meta'))
  assert('LINE含む', ids.includes('line'))
  assert('X含む', ids.includes('x'))
  assert('TikTok含む', ids.includes('tiktok'))
  assert('Yahoo!含む', ids.includes('yahoo'))
  assert('全媒体がmvp:true', MEDIA_OPTIONS.every(m => m.mvp))
})

// ============================================
// Test 3: getBenchmark() フォールバック
// ============================================
group('getBenchmark fallback', () => {
  const known = getBenchmark('ec')
  assert('既知の業種を返す', known.id === 'ec')

  const unknown = getBenchmark('non-existent-industry-xyz')
  assert('未知の業種は other にフォールバック', unknown.id === 'other')
})

// ============================================
// Test 4: 基本シミュレーション
// ============================================
group('simulate: basic 3-month / 3 media', () => {
  const input: SimulateInput = {
    industry: 'ec',
    monthlyBudget: 1_000_000,
    periodMonths: 3,
    mediaAllocation: { google: 50, meta: 30, line: 20 },
  }
  const result = simulate(input)

  assert('3媒体すべて結果が出ている', result.media.length === 3)
  assert('総予算 = 月額 × 期間', result.overall.totalBudget === 3_000_000,
    `actual: ${result.overall.totalBudget}`)

  // 各媒体の月次データ
  for (const m of result.media) {
    assert(`${m.mediaName}: 3ヶ月分の月次データ`, m.monthly.length === 3)
    assert(`${m.mediaName}: totalBudget > 0`, m.totalBudget > 0)
    assert(`${m.mediaName}: imp/click/cv が正`, m.summary.impression > 0 && m.summary.click > 0 && m.summary.cv > 0)
    assert(`${m.mediaName}: CPA > 0`, m.summary.avgCpa > 0)
  }

  // 学習曲線: 1ヶ月目より3ヶ月目のCVが多いはず
  for (const m of result.media) {
    const m1 = m.monthly[0].cv
    const m3 = m.monthly[2].cv
    assert(`${m.mediaName}: 月次学習曲線（1ヶ月目<3ヶ月目）`, m3 >= m1,
      `m1=${m1} m3=${m3}`)
  }

  // 配分の整合性: 50:30:20
  const total = result.media.reduce((a, b) => a + b.totalBudget, 0)
  assert('媒体別予算合計が総予算と一致', total === 3_000_000,
    `actual: ${total}`)
})

// ============================================
// Test 5: エッジケース - 1媒体100%配分
// ============================================
group('simulate: single media 100%', () => {
  const result = simulate({
    industry: 'saas',
    monthlyBudget: 500_000,
    periodMonths: 6,
    mediaAllocation: { google: 100 },
  })
  assert('1媒体のみ結果が出る', result.media.length === 1)
  assert('Google が選ばれている', result.media[0].mediaId === 'google')
  assert('6ヶ月分の月次データ', result.media[0].monthly.length === 6)
  assert('総予算 = 500k × 6', result.overall.totalBudget === 3_000_000)
})

// ============================================
// Test 6: エッジケース - 配分0% は無視
// ============================================
group('simulate: zero allocation skipped', () => {
  const result = simulate({
    industry: 'ec',
    monthlyBudget: 100_000,
    periodMonths: 1,
    mediaAllocation: { google: 100, meta: 0, line: 0 },
  })
  assert('配分0%の媒体はスキップ', result.media.length === 1)
  assert('Google だけが残る', result.media[0].mediaId === 'google')
})

// ============================================
// Test 7: 全6媒体配分
// ============================================
group('simulate: all 6 media', () => {
  const result = simulate({
    industry: 'beauty',
    monthlyBudget: 600_000,
    periodMonths: 3,
    mediaAllocation: {
      google: 30, meta: 25, line: 15, x: 10, tiktok: 10, yahoo: 10,
    },
  })
  assert('6媒体すべて結果が出る', result.media.length === 6)
  assert('総予算 = 600k × 3', result.overall.totalBudget === 1_800_000)
  assert('総CV > 0', result.overall.totalCv > 0)
})

// ============================================
// Test 8: ROAS 計算
// ============================================
group('simulate: ROAS calculation', () => {
  const result = simulate({
    industry: 'ec',
    monthlyBudget: 1_000_000,
    periodMonths: 1,
    mediaAllocation: { google: 100 },
    avgOrderValue: 50_000,
  })
  const m = result.media[0]
  // ROAS = (cv * 50000) / budget
  const expectedRoas = (m.summary.cv * 50_000) / m.totalBudget
  assert('ROAS = (CV × 客単価) / 予算',
    Math.abs(m.summary.avgRoas - Number(expectedRoas.toFixed(2))) < 0.01,
    `expected ~${expectedRoas.toFixed(2)} actual ${m.summary.avgRoas}`)
})

// ============================================
// Test 9: 業種ごとに値が異なることを確認
// ============================================
group('simulate: industries produce different results', () => {
  const baseInput = {
    monthlyBudget: 500_000,
    periodMonths: 3,
    mediaAllocation: { google: 100 },
  }
  const ec = simulate({ ...baseInput, industry: 'ec' })
  const finance = simulate({ ...baseInput, industry: 'finance' })

  assert('EC と 金融でCPAが異なる', ec.overall.avgCpa !== finance.overall.avgCpa,
    `ec=${ec.overall.avgCpa} finance=${finance.overall.avgCpa}`)
})

// ============================================
// Test 10: ゼロ予算
// ============================================
group('simulate: zero budget edge case', () => {
  const result = simulate({
    industry: 'ec',
    monthlyBudget: 0,
    periodMonths: 3,
    mediaAllocation: { google: 100 },
  })
  assert('予算0でもクラッシュしない', result !== null && result !== undefined)
  assert('総予算0', result.overall.totalBudget === 0)
})

// ============================================
// 結果出力
// ============================================
console.log(`\n${'='.repeat(50)}`)
console.log(`結果: ${passed} passed, ${failed} failed`)
console.log('='.repeat(50))

if (failed > 0) {
  console.log('\n失敗:')
  failures.forEach(f => console.log(f))
  process.exit(1)
} else {
  console.log('\n✓ All tests passed')
  process.exit(0)
}
