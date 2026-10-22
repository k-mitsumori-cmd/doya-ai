// 実行: npx tsx --test src/lib/annual-report/report.test.ts
// ⚠️ 環境変数・git・DB を使わない。日時はいつも引数で渡す。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allowedReveal,
  buildAnnualReport,
  cleanName,
  DEFAULT_REVEAL,
  formatYen,
  jstMonthIndex,
  parseRevealRequest,
  parseSize,
  parseYear,
  resolveReveal,
  topNames,
  yearRange,
  type AnnualRawData,
} from './report'
import { sampleAnnualRawData } from './sample'

const NOW = new Date('2026-10-19T01:00:00Z')

test('年は 2024 年から今年まで。ほかは今年に戻す', () => {
  assert.equal(parseYear('2025', NOW), 2025)
  assert.equal(parseYear(2024, NOW), 2024)
  for (const bad of ['2023', '2027', '20x5', '', null, undefined, '2025;drop', ' 2025 ']) {
    assert.equal(parseYear(bad, NOW), bad === ' 2025 ' ? 2025 : 2026, String(bad))
  }
  // JST では 2027 年になった直後
  assert.equal(parseYear('2027', new Date('2026-12-31T15:00:00Z')), 2027)
})

test('大きさは wide か tall だけ', () => {
  assert.equal(parseSize('tall'), 'tall')
  assert.equal(parseSize('wide'), 'wide')
  assert.equal(parseSize('9999x9999'), 'wide')
  assert.equal(parseSize(undefined), 'wide')
})

test('出す項目の既定は会社名だけ。知らない名前は捨てる', () => {
  assert.deepEqual(parseRevealRequest(null), [...DEFAULT_REVEAL])
  assert.deepEqual(parseRevealRequest(undefined), ['company'])
  assert.deepEqual(parseRevealRequest(''), [])
  assert.deepEqual(parseRevealRequest('amounts, customers,amounts,email,__proto__'), ['amounts', 'customers'])
})

test('管理者でない人には、顧客名・金額・社員名を許さない', () => {
  assert.deepEqual(allowedReveal({ isOrgAdmin: false }), ['company'])
  assert.deepEqual(allowedReveal({ isOrgAdmin: true }), ['company', 'customers', 'amounts', 'members'])
  assert.deepEqual(resolveReveal(['amounts', 'customers', 'members', 'company'], allowedReveal({ isOrgAdmin: false })), ['company'])
  assert.deepEqual(resolveReveal(['members', 'amounts'], allowedReveal({ isOrgAdmin: true })), ['amounts', 'members'])
})

test('年の区切りは JST', () => {
  const { start, end } = yearRange(2026)
  assert.equal(start.toISOString(), '2025-12-31T15:00:00.000Z')
  assert.equal(end.toISOString(), '2026-12-31T15:00:00.000Z')
  assert.equal(jstMonthIndex('2025-12-31T15:00:00Z', 2026), 0)
  assert.equal(jstMonthIndex('2025-12-31T14:59:59Z', 2026), -1)
  assert.equal(jstMonthIndex('2026-12-31T14:59:59Z', 2026), 11)
  assert.equal(jstMonthIndex('not a date', 2026), -1)
})

test('ツールごとの件数・月ごとの件数・時間の換算', () => {
  const raw: AnnualRawData = {
    companyName: 'テスト株式会社',
    events: {
      banner: ['2026-01-10T00:00:00Z', '2026-01-11T00:00:00Z', '2026-03-01T00:00:00Z', '2025-06-01T00:00:00Z'],
      seo: ['2026-03-05T00:00:00Z'],
      sfa: ['2026-03-06T00:00:00Z'],
    },
  }
  const r = buildAnnualReport(raw, { year: 2026, reveal: DEFAULT_REVEAL })
  assert.equal(r.totalItems, 5)
  assert.deepEqual(r.tools.map((t) => [t.id, t.count]), [['banner', 3], ['seo', 1], ['sfa', 1]])
  // バナー 3×30分 + SEO 180分 = 270分 = 4.5 時間 → 5 時間、0.6 日
  assert.equal(r.hoursSaved, 5)
  assert.equal(r.workdaysSaved, 0.6)
  assert.deepEqual(r.monthly, [2, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  assert.equal(r.busiestMonth, 3)
  assert.equal(r.activeMonths, 2)
  assert.equal(r.companyName, 'テスト株式会社')
})

test('記録が無い年は 0 件で、いちばんの月は無い', () => {
  const r = buildAnnualReport({ companyName: null, events: {} }, { year: 2025, reveal: DEFAULT_REVEAL })
  assert.equal(r.totalItems, 0)
  assert.equal(r.hoursSaved, 0)
  assert.equal(r.busiestMonth, null)
  assert.deepEqual(r.tools, [])
  assert.deepEqual(r.revealed, [])
})

test('顧客名・金額・社員名は、選んでいなければ渡されても入れない', () => {
  const raw = sampleAnnualRawData(2026)
  const r = buildAnnualReport(raw, { year: 2026, reveal: [] })
  assert.equal(r.companyName, null)
  assert.equal(r.amounts, null)
  assert.equal(r.customers, null)
  assert.equal(r.members, null)
  const text = JSON.stringify(r)
  for (const secret of ['見本商事', '青空テック', '山田', '18400000', '12650000']) assert.ok(!text.includes(secret), secret)
})

test('選んだ項目だけを入れる', () => {
  const raw = sampleAnnualRawData(2026)
  const r = buildAnnualReport(raw, { year: 2026, reveal: ['customers'] })
  assert.deepEqual(r.customers, ['青空テック', 'みどり製作所', '港町フーズ'])
  assert.equal(r.amounts, null)
  assert.equal(r.members, null)
  assert.equal(r.companyName, null)
  assert.deepEqual(r.revealed, ['customers'])
  const all = buildAnnualReport(raw, { year: 2026, reveal: ['company', 'customers', 'amounts', 'members'] })
  assert.deepEqual(all.amounts, { quoted: 18_400_000, won: 12_650_000 })
  assert.deepEqual(all.members, ['佐藤', '山田', '鈴木'])
  assert.deepEqual(all.revealed, ['company', 'customers', 'amounts', 'members'])
})

test('名前は整えて短くする。金額の負の値・壊れた値は 0', () => {
  assert.equal(cleanName('  株式会社\u0000\nテスト  '), '株式会社 テスト')
  assert.equal(cleanName('あ'.repeat(30))?.length, 20)
  assert.equal(cleanName(42), null)
  assert.deepEqual(topNames(['', null, 'A', 'B', 'B']), ['B', 'A'])
  const r = buildAnnualReport({ companyName: null, events: {}, amounts: { quoted: -5, won: Number.NaN } }, { year: 2026, reveal: ['amounts'] })
  assert.equal(r.amounts, null)
})

test('円の表示', () => {
  assert.equal(formatYen(9_800), '9,800円')
  assert.equal(formatYen(12_650_000), '1,265万円')
  assert.equal(formatYen(250_000_000), '2.5億円')
})
