// 実行: npx tsx --test src/lib/products/hub-metrics.test.ts
// 製品のホームの数字（マーケティング・段3）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marketingMetrics, yen } from './hub-metrics'
import type { MarketingSummary } from './marketing-summary'

const base: MarketingSummary = {
  banner: { state: 'ready', href: '/banner', thisMonth: 12, total: 1340 },
  seo: { state: 'ready', href: '/seo', thisMonth: 3, total: 40, doneThisMonth: 2 },
  persona: { state: 'empty', href: '/persona', thisMonth: 0, total: 0 },
  aio: { state: 'ready', href: '/aio', awarenessPct: 41.6, shareOfVoice: 18.2, scannedAt: '2026-11-01T16:00:00.000Z', scansThisMonth: 1 },
}

test('マーケティングの数字: 今月の数と、これまでの数を出す', () => {
  const m = marketingMetrics(base)
  assert.deepEqual(m.map((x) => x.key), ['banner', 'seo', 'aio', 'persona'])
  assert.equal(m[0].value, '12枚')
  assert.equal(m[0].sub, 'これまで 1,340枚')
  assert.equal(m[1].sub, '書き上がった記事 2本・これまで 40本')
  // 日付は日本時間（UTC 11/1 16:00 = JST 11/2）
  assert.equal(m[2].value, '42%')
  assert.equal(m[2].sub, '11月2日の調べ・追っている会社の中で 18%')
})

test('マーケティングの数字: まだ無い・読めない欄は state で分かる（作り物を出さない）', () => {
  const m = marketingMetrics({ ...base, aio: { state: 'empty', href: '/aio', awarenessPct: null, shareOfVoice: null, scannedAt: null, scansThisMonth: 0 }, banner: { ...base.banner, state: 'error' } })
  assert.equal(m[2].state, 'empty')
  assert.equal(m[2].value, '—')
  assert.equal(m[2].sub, undefined)
  assert.equal(m[0].state, 'error')
  assert.equal(m[3].state, 'empty')
})

test('金額の書式', () => {
  assert.equal(yen(3_200_000), '320万円')
  assert.equal(yen(9_800), '9,800円')
})
