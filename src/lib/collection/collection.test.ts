// 実行: npx tsx --test src/lib/collection/collection.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalog, stampSrc } from './catalog'
import { utilizationScore, usedToolIds } from './score'
import { evaluateBadges, visibleBadges } from './badges'
import { cleanBillingMonths, jstMonthKey } from './billing'
import { parseAreas, suggestAreas } from './areas'
import { emptyFacts } from './types'

const GROUPS = [
  { stage: 'collect', tools: [
    { id: 'seo', name: '記事作成', href: '/seo', icon: 'PenTool', hint: '' },
    { id: 'banner', name: 'バナー', href: '/banner', icon: 'Image', hint: '' },
  ] },
  { stage: 'sell', tools: [{ id: 'sfa', name: '営業管理', href: '/sfa', icon: 'Briefcase', hint: '' }] },
  { stage: 'hire', tools: [
    { id: 'mensetsu', name: '面接', href: '/mensetsu', icon: 'UserCheck', hint: '' },
    { id: 'hr', name: '人事', href: '/hr', icon: 'Users', hint: '' },
  ] },
  { stage: 'operate', tools: [
    { id: 'quote', name: '見積', href: '/quote', icon: 'FileText', hint: '' },
    { id: 'income', name: '収入管理', href: '/income', icon: 'Receipt', hint: '' },
    { id: 'beta-tool', name: '開発中', href: '/x', icon: 'Box', hint: '', beta: true },
  ] },
  { stage: 'other', tools: [{ id: 'misc', name: 'その他', href: '/misc', icon: 'Box', hint: '' }] },
]
const TOOLS = buildCatalog(GROUPS)

test('図鑑: 「その他」の区分は載せない。区分が分野になる', () => {
  assert.equal(TOOLS.some((t) => t.id === 'misc'), false)
  assert.equal(TOOLS.find((t) => t.id === 'quote')?.area, 'operate')
  assert.equal(TOOLS.length, 8)
})

test('スタンプ: 画像を用意したツールだけ画像の場所を返す', () => {
  assert.equal(stampSrc('seo', new Set()), null)
  assert.equal(stampSrc('seo', new Set(['seo'])), '/collection/stamps/seo.webp')
})

test('活用度: 選んだ分野の中だけで計算する（採用を使わない会社は採用で減点しない）', () => {
  const used = new Set(['seo', 'quote', 'income'])
  const withoutHire = utilizationScore(TOOLS, used, ['collect', 'operate'])
  assert.equal(withoutHire.total, 4) // seo, banner, quote, income（開発中は入れない）
  assert.equal(withoutHire.used, 3)
  assert.equal(withoutHire.percent, 75)
  const withHire = utilizationScore(TOOLS, used, ['collect', 'operate', 'hire'])
  assert.equal(withHire.percent, 50)
})

test('活用度: 開発中のツールは分母にも分子にも入れない', () => {
  const s = utilizationScore(TOOLS, new Set(['quote', 'income', 'beta-tool']), ['operate'])
  assert.equal(s.total, 2)
  assert.equal(s.used, 2)
  assert.equal(s.percent, 100)
})

test('活用度: 分野を選んでいないと点を出さない。まだのツールを分野ごとに返す', () => {
  assert.equal(utilizationScore(TOOLS, new Set(['seo']), []).percent, null)
  const s = utilizationScore(TOOLS, new Set(['seo']), ['collect'])
  assert.deepEqual(s.areas[0].unusedTools.map((t) => t.id), ['banner'])
})

test('使ったツール: 記録が1件以上のものだけ', () => {
  assert.deepEqual([...usedToolIds({ seo: { count: 2 }, banner: { count: 0 } })], ['seo'])
})

test('バッジ: 記録が無ければ取れていない。数が届いたら取れる', () => {
  const none = evaluateBadges(emptyFacts())
  assert.equal(none.every((b) => !b.earned), true)
  const f = emptyFacts()
  f.quotesSent = { count: 1, firstAt: '2026-09-01T00:00:00.000Z' }
  f.articlesDone = { count: 9, firstAt: '2026-01-01T00:00:00.000Z' }
  const s = evaluateBadges(f)
  const quote = s.find((b) => b.id === 'first-quote-sent')!
  assert.equal(quote.earned, true)
  assert.equal(quote.earnedAt, '2026-09-01T00:00:00.000Z')
  const art = s.find((b) => b.id === 'articles-10')!
  assert.equal(art.earned, false)
  assert.equal(art.current, 9)
  assert.equal(art.earnedAt, null)
  f.articlesDone = { count: 25, firstAt: null }
  const art2 = evaluateBadges(f).find((b) => b.id === 'articles-10')!
  assert.equal(art2.earned, true)
  assert.equal(art2.current, 10) // 目標で止める
})

test('バッジ: 関数を持たない（クライアントの部品に渡せる）', () => {
  for (const b of evaluateBadges(emptyFacts())) {
    for (const v of Object.values(b)) assert.notEqual(typeof v, 'function')
  }
})

test('バッジ: 請求漏れ0の月の数で取れる', () => {
  const f = emptyFacts()
  f.cleanBillingMonths = ['2026-07', '2026-08']
  const s = evaluateBadges(f)
  assert.equal(s.find((b) => b.id === 'clean-billing-month')!.earned, true)
  assert.equal(s.find((b) => b.id === 'clean-billing-3')!.earned, false)
  assert.equal(s.find((b) => b.id === 'clean-billing-3')!.current, 2)
})

test('バッジの表示: 取ったものはいつも出す。まだのものは選んだ分野だけ', () => {
  const f = emptyFacts()
  f.interviewsDone = { count: 1, firstAt: null }
  const v = visibleBadges(evaluateBadges(f), ['operate'])
  assert.equal(v.some((b) => b.id === 'first-interview-done'), true) // 採用は選んでいないが、取ったので出す
  assert.equal(v.some((b) => b.id === 'first-deal-won'), false) // 営業は選んでいない・まだ
  assert.equal(v.some((b) => b.id === 'first-invoice'), true)
})

test('請求漏れ0の月: 全部請求済み・見送りの締まった月だけ。今月は数えない', () => {
  const now = new Date('2026-10-19T01:00:00Z')
  const rows = [
    { plannedIssueDate: '2026-07-31T00:00:00.000Z', status: 'invoiced' },
    { plannedIssueDate: '2026-07-01T00:00:00.000Z', status: 'skipped' },
    { plannedIssueDate: '2026-08-25T00:00:00.000Z', status: 'invoiced' },
    { plannedIssueDate: '2026-08-31T00:00:00.000Z', status: 'planned' }, // 8月は漏れあり
    { plannedIssueDate: new Date('2026-09-30T00:00:00.000Z'), status: 'invoiced' },
    { plannedIssueDate: '2026-10-01T00:00:00.000Z', status: 'invoiced' }, // 今月
  ]
  assert.deepEqual(cleanBillingMonths(rows, now), ['2026-07', '2026-09'])
  assert.deepEqual(cleanBillingMonths([], now), [])
})

test('今月は日本時間で決める', () => {
  assert.equal(jstMonthKey(new Date('2026-09-30T16:00:00Z')), '2026-10')
  assert.equal(jstMonthKey(new Date('2026-09-30T14:00:00Z')), '2026-09')
})

test('分野の仮の保存: 壊れた値は保存が無い扱い', () => {
  assert.equal(parseAreas(null), null)
  assert.equal(parseAreas('{'), null)
  assert.equal(parseAreas('"collect"'), null)
  assert.equal(parseAreas('["collect","nope"]'), null)
  assert.deepEqual(parseAreas('["operate","collect"]'), ['collect', 'operate'])
  assert.deepEqual(parseAreas('[]'), [])
})

test('分野の仮の選択: 1つでも使った分野', () => {
  assert.deepEqual(suggestAreas(TOOLS, new Set(['quote', 'sfa'])), ['sell', 'operate'])
  assert.deepEqual(suggestAreas(TOOLS, new Set()), [])
})
